/**
 * Dreamscape (Promenades oniriques) — MariaDB
 */
import { randomBytes } from 'crypto'
import type { RowDataPacket } from 'mysql2'
import { exec, getPool, table } from './db'

const tbl = () => table('fleur_dreamscape')

// Singleton DDL — CREATE TABLE une seule fois par process
let _ensureTablePromise: Promise<void> | null = null
export function ensureTable(): Promise<void> {
  if (!_ensureTablePromise) {
    const pool = getPool()
    const t = tbl()
    _ensureTablePromise = pool.execute(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        history_json MEDIUMTEXT,
        poetic_reflection TEXT,
        slots_json TEXT,
        petals_json TEXT,
        snapshot_base64 LONGTEXT,
        share_token VARCHAR(64) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).then(() => undefined).catch((err) => { _ensureTablePromise = null; throw err })
  }
  return _ensureTablePromise
}

export async function save(userId: string, body: Record<string, unknown>): Promise<{ id: number }> {
  const pool = getPool()
  await ensureTable()
  const t = tbl()
  const sql = `INSERT INTO ${t} (user_id, history_json, poetic_reflection, slots_json, petals_json, snapshot_base64)
     VALUES (?, ?, ?, ?, ?, ?)`
  const values: (string | null)[] = [
    userId,
    JSON.stringify(body.history ?? []),
    (body.poeticReflection as string) ?? null,
    JSON.stringify(body.slots ?? []),
    JSON.stringify(body.petals ?? {}),
    (body.snapshot as string) ?? null,
  ]
  await exec(pool, sql, values)
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT LAST_INSERT_ID() as id')
  return { id: Number(rows[0]?.id) }
}

export async function update(
  userId: string,
  id: number,
  body: Record<string, unknown>
): Promise<void> {
  const pool = getPool()
  const t = tbl()
  const sql = `UPDATE ${t} SET history_json = ?, poetic_reflection = ?, slots_json = ?, petals_json = ?, snapshot_base64 = ?
     WHERE id = ? AND user_id = ?`
  const values: (string | number | null)[] = [
    JSON.stringify(body.history ?? []),
    (body.poeticReflection as string) ?? null,
    JSON.stringify(body.slots ?? []),
    JSON.stringify(body.petals ?? {}),
    (body.snapshot as string) ?? null,
    id,
    userId,
  ]
  const [result] = await exec(pool, sql, values)
  const affected = (result as { affectedRows?: number }).affectedRows ?? 0
  if (affected === 0) throw new Error('Promenade introuvable ou accès refusé')
}

/** Mise à jour uniquement du snapshot (régénération visuel), sans toucher au reste. */
export async function updateSnapshot(userId: string, id: number, snapshotBase64: string | null): Promise<void> {
  const pool = getPool()
  const t = tbl()
  const sql = `UPDATE ${t} SET snapshot_base64 = ? WHERE id = ? AND user_id = ?`
  const [result] = await exec(pool, sql, [snapshotBase64, id, userId])
  const affected = (result as { affectedRows?: number }).affectedRows ?? 0
  if (affected === 0) throw new Error('Promenade introuvable ou accès refusé')
}

export async function my(userId: string): Promise<{ items: Record<string, unknown>[] }> {
  const pool = getPool()
  await ensureTable()
  const t = tbl()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, history_json, poetic_reflection, slots_json, petals_json, snapshot_base64, created_at
     FROM ${t} WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
    [userId]
  )
  const items = rows.map((r) => ({
    id: Number(r.id),
    history: JSON.parse(r.history_json || '[]'),
    poeticReflection: r.poetic_reflection,
    slots: JSON.parse(r.slots_json || '[]'),
    petals: JSON.parse(r.petals_json || '{}'),
    snapshot: r.snapshot_base64 || null,
    savedAt: r.created_at,
  }))
  return { items }
}

export async function share(userId: string, id: number): Promise<{ shareToken: string; shareUrl: string }> {
  const pool = getPool()
  const t = tbl()
  try {
    await pool.execute(`ALTER TABLE ${t} ADD COLUMN share_token VARCHAR(64) NULL`)
  } catch {
    /* column exists */
  }
  const token = randomBytes(16).toString('hex')
  const sql = `UPDATE ${t} SET share_token = ? WHERE id = ? AND user_id = ?`
  const [result] = await exec(pool, sql, [token, id, userId])
  const affected = (result as { affectedRows?: number }).affectedRows ?? 0
  if (affected === 0) throw new Error('Promenade introuvable ou accès refusé')
  return { shareToken: token, shareUrl: `/dreamscape/partage/${token}` }
}

export async function getShared(token: string): Promise<Record<string, unknown>> {
  const pool = getPool()
  const t = tbl()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, history_json, poetic_reflection, slots_json, petals_json, snapshot_base64, created_at
     FROM ${t} WHERE share_token = ?`,
    [token]
  )
  const r = rows[0]
  if (!r) throw new Error('Partage introuvable ou expiré')
  return {
    id: Number(r.id),
    history: JSON.parse(r.history_json || '[]'),
    poeticReflection: r.poetic_reflection,
    slots: JSON.parse(r.slots_json || '[]'),
    petals: JSON.parse(r.petals_json || '{}'),
    snapshot: r.snapshot_base64 || null,
    savedAt: r.created_at,
  }
}

export async function getSharedImage(token: string): Promise<{ base64: string; mime: string } | null> {
  const pool = getPool()
  const t = tbl()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT snapshot_base64 FROM ${t} WHERE share_token = ?`,
    [token]
  )
  const r = rows[0]
  if (!r?.snapshot_base64) return null
  const raw = r.snapshot_base64
  const m = String(raw).match(/^data:image\/(\w+);base64,(.+)$/)
  if (m) return { base64: m[2], mime: `image/${m[1]}` }
  return { base64: String(raw).replace(/^data:image\/\w+;base64,/, ''), mime: 'image/png' }
}
