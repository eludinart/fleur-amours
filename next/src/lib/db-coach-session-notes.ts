/**
 * Notes libres coach par session (hors step_data / IA) — MariaDB.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'

const TBL = () => table('fleur_coach_session_notes')

async function ensureTable(): Promise<void> {
  if (!isDbConfigured()) return
  const pool = getPool()
  const t = TBL()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${t} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coach_user_id INT NOT NULL,
      session_id INT NOT NULL,
      note_text MEDIUMTEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_coach_session (coach_user_id, session_id),
      INDEX idx_session (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export async function getCoachSessionNote(params: {
  coachUserId: number
  sessionId: number
}): Promise<string | null> {
  const { coachUserId, sessionId } = params
  if (!isDbConfigured() || !Number.isFinite(sessionId) || sessionId <= 0) return null
  await ensureTable()
  const pool = getPool()
  const t = TBL()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT note_text FROM ${t} WHERE coach_user_id = ? AND session_id = ? LIMIT 1`,
    [coachUserId, sessionId]
  )
  const raw = (rows?.[0] as { note_text?: string | null })?.note_text
  if (raw == null || raw === '') return null
  return String(raw)
}

export async function getCoachSessionNotesMap(params: {
  coachUserId: number
  sessionIds: number[]
}): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  const ids = [...new Set(params.sessionIds.filter((n) => Number.isFinite(n) && n > 0))]
  if (!ids.length || !isDbConfigured()) return out
  await ensureTable()
  const pool = getPool()
  const t = TBL()
  const placeholders = ids.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT session_id, note_text FROM ${t} WHERE coach_user_id = ? AND session_id IN (${placeholders})`,
    [params.coachUserId, ...ids]
  )
  for (const r of rows ?? []) {
    const sid = Number((r as any).session_id)
    const txt = (r as any).note_text != null ? String((r as any).note_text) : ''
    if (Number.isFinite(sid) && sid > 0 && txt.trim()) out.set(sid, txt)
  }
  return out
}

export async function upsertCoachSessionNote(params: {
  coachUserId: number
  sessionId: number
  noteText: string
}): Promise<void> {
  const { coachUserId, sessionId, noteText } = params
  if (!isDbConfigured() || !Number.isFinite(sessionId) || sessionId <= 0) return
  await ensureTable()
  const pool = getPool()
  const t = TBL()
  const text = String(noteText ?? '').trim()
  if (!text) {
    await pool.execute(`DELETE FROM ${t} WHERE coach_user_id = ? AND session_id = ?`, [coachUserId, sessionId])
    return
  }
  await pool.execute(
    `INSERT INTO ${t} (coach_user_id, session_id, note_text) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE note_text = VALUES(note_text)`,
    [coachUserId, sessionId, text]
  )
}
