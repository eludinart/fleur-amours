/**
 * Tirages Tarot — MariaDB (fleur_tarot_readings).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from './db'

const TBL = () => table('fleur_tarot_readings')

function formatReading(r: RowDataPacket): Record<string, unknown> {
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
    createdAt: r.created_at ?? null,
    created_at: r.created_at ?? null,
    email: r.email ?? null,
    type: r.type ?? 'simple',
  }
}

// Singleton DDL — CREATE TABLE + index une seule fois par process
let _ensureTablePromise: Promise<void> | null = null
export function ensureTable(): Promise<void> {
  if (!_ensureTablePromise) {
    const pool = getPool()
    const t = TBL()
    _ensureTablePromise = (async () => {
      await pool.execute(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        email VARCHAR(255) DEFAULT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'simple',
        payload JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY idx_ft_user_created (user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
      try {
        await pool.execute(`ALTER TABLE ${t} ADD INDEX idx_ft_user_created (user_id, created_at)`)
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

export async function save(params: {
  user_id: number | null
  email: string | null
  type: string
  payload: Record<string, unknown>
}): Promise<Record<string, unknown>> {
  const pool = getPool()
  await ensureTable()
  const t = TBL()
  const type = ['simple', 'four'].includes(params.type) ? params.type : 'simple'
  const payloadStr = JSON.stringify(params.payload ?? {})

  await pool.execute(
    `INSERT INTO ${t} (user_id, email, type, payload) VALUES (?, ?, ?, ?)`,
    [params.user_id ?? null, params.email ?? null, type, payloadStr]
  )
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, email, type, payload, created_at FROM ${t} ORDER BY id DESC LIMIT 1`
  )
  const r = rows[0]
  if (!r) throw new Error('Insert failed')
  return formatReading(r)
}

export async function my(userId: string, email?: string | null): Promise<{ items: Record<string, unknown>[] }> {
  const pool = getPool()
  await ensureTable()
  const t = TBL()
  let sql: string
  const params: (string | number)[] = []
  if (userId) {
    sql = `SELECT id, user_id, email, type, payload, created_at FROM ${t} WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
    params.push(parseInt(userId, 10))
  } else if (email) {
    sql = `SELECT id, user_id, email, type, payload, created_at FROM ${t} WHERE email = ? ORDER BY created_at DESC LIMIT 100`
    params.push(email)
  } else {
    return { items: [] }
  }
  const [rows] = await pool.execute<RowDataPacket[]>(sql, params)
  return { items: rows.map((r) => formatReading(r)) }
}

export async function list(params: {
  page?: number
  per_page?: number
  search?: string
}): Promise<{ items: Record<string, unknown>[]; total: number; page: number; pages: number }> {
  const pool = getPool()
  await ensureTable()
  const t = TBL()
  const page = Math.max(1, params.page ?? 1)
  const perPage = Math.min(50, Math.max(1, params.per_page ?? 20))
  const offset = (page - 1) * perPage

  let where = '1=1'
  const values: (string | number)[] = []
  if (params.search) {
    where += ' AND email LIKE ?'
    values.push(`%${params.search}%`)
  }

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM ${t} WHERE ${where}`,
    values
  )
  const total = Number(countRows[0]?.total ?? 0)

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, email, type, payload, created_at FROM ${t} WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, perPage, offset]
  )
  return {
    items: rows.map((r) => formatReading(r)),
    total,
    page,
    pages: Math.ceil(total / perPage) || 1,
  }
}

export async function getById(id: number, userId?: string, email?: string): Promise<Record<string, unknown> | null> {
  const pool = getPool()
  await ensureTable()
  const t = TBL()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, email, type, payload, created_at FROM ${t} WHERE id = ?`,
    [id]
  )
  const r = rows[0]
  if (!r) return null
  if (userId && r.user_id != null && Number(r.user_id) !== parseInt(userId, 10)) return null
  if (email && (r.email ?? '') !== email) return null
  return formatReading(r)
}

export async function update(
  id: number,
  payload: Record<string, unknown>,
  userId?: string
): Promise<Record<string, unknown> | null> {
  const pool = getPool()
  const t = TBL()
  if (userId) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id FROM ${t} WHERE id = ?`,
      [id]
    )
    const r = rows[0]
    if (!r || (r.user_id != null && Number(r.user_id) !== parseInt(userId, 10))) return null
  }
  const [result] = await pool.execute(
    `UPDATE ${t} SET payload = ? WHERE id = ?`,
    [JSON.stringify(payload ?? {}), id]
  )
  const affected = (result as { affectedRows?: number }).affectedRows ?? 0
  if (affected === 0) return null
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, email, type, payload, created_at FROM ${t} WHERE id = ?`,
    [id]
  )
  return rows[0] ? formatReading(rows[0]) : null
}

export async function deleteById(id: number, userId?: string): Promise<boolean> {
  const pool = getPool()
  const t = TBL()
  if (userId) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id FROM ${t} WHERE id = ?`,
      [id]
    )
    const r = rows[0]
    if (!r || (r.user_id != null && Number(r.user_id) !== parseInt(userId, 10))) return false
  }
  const [result] = await pool.execute(`DELETE FROM ${t} WHERE id = ?`, [id])
  return ((result as { affectedRows?: number }).affectedRows ?? 0) > 0
}

export async function stats(): Promise<{ total: number }> {
  const pool = getPool()
  try {
    await ensureTable()
  } catch {
    return { total: 0 }
  }
  const t = TBL()
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM ${t}`)
  return { total: Number(rows[0]?.total ?? 0) }
}
