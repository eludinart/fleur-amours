/**
 * Tirages papier — MariaDB (fleur_paper_draws).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from './db'

const TBL = () => table('fleur_paper_draws')

function formatRow(r: RowDataPacket): Record<string, unknown> {
  let payload: Record<string, unknown> = {}
  try {
    const raw = r.payload
    if (typeof raw === 'string') payload = JSON.parse(raw || '{}')
    else if (raw && typeof raw === 'object') payload = raw as Record<string, unknown>
  } catch {
    /* ignore */
  }
  return {
    ...payload,
    id: String(r.id ?? ''),
    layout_template: r.layout_template ?? payload.layout_template ?? 'free',
    createdAt: r.created_at ?? null,
    created_at: r.created_at ?? null,
  }
}

let _ensureTablePromise: Promise<void> | null = null

export function ensurePaperDrawTable(): Promise<void> {
  if (!_ensureTablePromise) {
    const pool = getPool()
    const t = TBL()
    _ensureTablePromise = (async () => {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS ${t} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT DEFAULT NULL,
          email VARCHAR(255) DEFAULT NULL,
          layout_template VARCHAR(32) NOT NULL DEFAULT 'free',
          payload JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          KEY idx_fpd_user_created (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      try {
        await pool.execute(`ALTER TABLE ${t} ADD INDEX idx_fpd_user_created (user_id, created_at)`)
      } catch (e: unknown) {
        const err = e as { errno?: number; code?: string }
        if (err.errno !== 1061 && err.code !== 'ER_DUP_KEYNAME') throw e
      }
    })().catch((err) => {
      _ensureTablePromise = null
      throw err
    })
  }
  return _ensureTablePromise
}

export async function savePaperDraw(params: {
  user_id: number | null
  email: string | null
  layout_template: string
  payload: Record<string, unknown>
}): Promise<Record<string, unknown>> {
  const pool = getPool()
  await ensurePaperDrawTable()
  const t = TBL()
  const layout = String(params.layout_template ?? 'free').slice(0, 32)
  const payloadStr = JSON.stringify(params.payload ?? {})

  await pool.execute(
    `INSERT INTO ${t} (user_id, email, layout_template, payload) VALUES (?, ?, ?, ?)`,
    [params.user_id ?? null, params.email ?? null, layout, payloadStr]
  )
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, email, layout_template, payload, created_at FROM ${t} ORDER BY id DESC LIMIT 1`
  )
  const r = rows[0]
  if (!r) throw new Error('Insert failed')
  return formatRow(r)
}

export async function updatePaperDraw(params: {
  id: number
  user_id: number
  payload: Record<string, unknown>
}): Promise<boolean> {
  const pool = getPool()
  await ensurePaperDrawTable()
  const t = TBL()
  const payloadStr = JSON.stringify(params.payload ?? {})
  const [res] = await pool.execute(
    `UPDATE ${t} SET payload = ? WHERE id = ? AND user_id = ?`,
    [payloadStr, params.id, params.user_id]
  )
  return (res as { affectedRows?: number }).affectedRows === 1
}

export async function myPaperDraws(
  userId: string
): Promise<{ items: Record<string, unknown>[] }> {
  const pool = getPool()
  await ensurePaperDrawTable()
  const t = TBL()
  const uid = parseInt(userId, 10)
  if (!uid) return { items: [] }
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, email, layout_template, payload, created_at FROM ${t} WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
    [uid]
  )
  return { items: rows.map((r) => formatRow(r)) }
}

export async function getPaperDraw(
  id: number,
  userId: number
): Promise<Record<string, unknown> | null> {
  const pool = getPool()
  await ensurePaperDrawTable()
  const t = TBL()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, email, layout_template, payload, created_at FROM ${t} WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  )
  const r = rows[0]
  return r ? formatRow(r) : null
}
