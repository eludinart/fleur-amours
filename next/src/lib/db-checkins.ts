/**
 * Check-ins relationnels — MariaDB.
 *
 * Table `fleur_checkins` : rituel « Écho du jour » (intention, réponse IA,
 * pétale mis en valeur) + ancres légères (felt_after). Alimente la timeline.
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'
import { parseStoredAiResponse, type CheckinEchoResponse } from './checkin-echo'

const TBL = () => table('fleur_checkins')

export type Checkin = {
  id: number
  userId: number
  mood: number
  tension: number
  note: string | null
  intention: string | null
  highlightPetal: string | null
  aiResponse: CheckinEchoResponse | null
  feltAfter: number | null
  createdAt: string
}

let _ensurePromise: Promise<void> | null = null

async function migrateCheckinsColumns(pool: ReturnType<typeof getPool>): Promise<void> {
  const t = TBL()
  const alters = [
    `ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS intention VARCHAR(500) DEFAULT NULL`,
    `ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS highlight_petal VARCHAR(32) DEFAULT NULL`,
    `ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS ai_response_json TEXT DEFAULT NULL`,
    `ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS felt_after TINYINT DEFAULT NULL`,
  ]
  for (const sql of alters) {
    try {
      await pool.execute(sql)
    } catch {
      /* colonne déjà présente ou IF NOT EXISTS non supporté */
    }
  }
}

export function ensureCheckinsTable(): Promise<void> {
  if (!isDbConfigured()) return Promise.resolve()
  if (!_ensurePromise) {
    _ensurePromise = getPool()
      .execute(`
        CREATE TABLE IF NOT EXISTS ${TBL()} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          mood TINYINT NOT NULL DEFAULT 3,
          tension TINYINT NOT NULL DEFAULT 3,
          note VARCHAR(500) DEFAULT NULL,
          intention VARCHAR(500) DEFAULT NULL,
          highlight_petal VARCHAR(32) DEFAULT NULL,
          ai_response_json TEXT DEFAULT NULL,
          felt_after TINYINT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_created (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      .then(() => migrateCheckinsColumns(getPool()))
      .then(() => undefined)
      .catch((err) => {
        _ensurePromise = null
        throw err
      })
  }
  return _ensurePromise
}

function clamp1to5(v: unknown): number {
  const n = parseInt(String(v), 10)
  if (!Number.isFinite(n)) return 3
  return Math.min(Math.max(n, 1), 5)
}

function clampFelt(v: unknown): number | null {
  if (v == null) return null
  const n = parseInt(String(v), 10)
  if (!Number.isFinite(n)) return null
  return Math.min(Math.max(n, 1), 3)
}

function rowToCheckin(r: RowDataPacket): Checkin {
  return {
    id: Number(r.id),
    userId: Number(r.user_id),
    mood: Number(r.mood),
    tension: Number(r.tension),
    note: r.note ?? null,
    intention: r.intention ?? null,
    highlightPetal: r.highlight_petal ?? null,
    aiResponse: parseStoredAiResponse(r.ai_response_json != null ? String(r.ai_response_json) : null),
    feltAfter: r.felt_after != null ? Number(r.felt_after) : null,
    createdAt: String(r.created_at ?? ''),
  }
}

export async function saveCheckin(input: {
  userId: number
  mood?: unknown
  tension?: unknown
  note?: string | null
  intention?: string | null
  highlightPetal?: string | null
  aiResponse?: CheckinEchoResponse | null
  feltAfter?: unknown
}): Promise<{ id: number; mood: number; tension: number }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureCheckinsTable()
  const pool = getPool()
  const mood = clamp1to5(input.mood ?? 3)
  const tension = clamp1to5(input.tension ?? 3)
  const note = input.note != null ? String(input.note).slice(0, 500) : null
  const intention = input.intention != null ? String(input.intention).slice(0, 500) : null
  const highlightPetal = input.highlightPetal != null ? String(input.highlightPetal).slice(0, 32) : null
  const aiJson =
    input.aiResponse && typeof input.aiResponse === 'object'
      ? JSON.stringify(input.aiResponse)
      : null
  const feltAfter = clampFelt(input.feltAfter)

  const [res] = await exec(
    pool,
    `INSERT INTO ${TBL()} (user_id, mood, tension, note, intention, highlight_petal, ai_response_json, felt_after)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.userId, mood, tension, note, intention, highlightPetal, aiJson, feltAfter]
  )
  return { id: Number((res as ResultSetHeader).insertId), mood, tension }
}

export async function getMyCheckins(userId: number, limit = 30): Promise<Checkin[]> {
  if (!isDbConfigured()) return []
  await ensureCheckinsTable()
  const pool = getPool()
  const safe = Math.min(Math.max(parseInt(String(limit), 10) || 30, 1), 120)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${TBL()} WHERE user_id = ? ORDER BY created_at DESC LIMIT ${safe}`,
    [userId]
  )
  return rows.map(rowToCheckin)
}

/** Un seul écho par jour calendaire (fuseau serveur / CURDATE). */
export async function hasCheckinToday(userId: number): Promise<boolean> {
  if (!isDbConfigured()) return false
  await ensureCheckinsTable()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM ${TBL()} WHERE user_id = ? AND DATE(created_at) = CURDATE() LIMIT 1`,
    [userId]
  )
  return rows.length > 0
}

export async function getTodayCheckin(userId: number): Promise<Checkin | null> {
  if (!isDbConfigured()) return null
  await ensureCheckinsTable()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${TBL()} WHERE user_id = ? AND DATE(created_at) = CURDATE() ORDER BY created_at DESC LIMIT 1`,
    [userId]
  )
  return rows[0] ? rowToCheckin(rows[0]) : null
}

/**
 * Candidats à une relance check-in : utilisateurs avec une activité récente
 * (timeline) mais sans check-in depuis `staleDays` jours. Borné par `limit`.
 */
export async function findCheckinReminderCandidates(params: {
  staleDays?: number
  activityDays?: number
  limit?: number
}): Promise<Array<{ userId: number; email: string | null }>> {
  if (!isDbConfigured()) return []
  await ensureCheckinsTable()
  const pool = getPool()
  const staleDays = Math.min(Math.max(params.staleDays ?? 7, 1), 90)
  const activityDays = Math.min(Math.max(params.activityDays ?? 30, 1), 365)
  const limit = Math.min(Math.max(params.limit ?? 200, 1), 1000)
  const tTimeline = table('fleur_timeline_events')
  const tUsers = table('users')
  const tCheckins = TBL()

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT te.user_id AS user_id, u.user_email AS email
       FROM ${tTimeline} te
       JOIN ${tUsers} u ON u.ID = te.user_id
      WHERE te.created_at >= (NOW() - INTERVAL ? DAY)
        AND NOT EXISTS (
          SELECT 1 FROM ${tCheckins} c
           WHERE c.user_id = te.user_id
             AND c.created_at >= (NOW() - INTERVAL ? DAY)
        )
      LIMIT ${limit}`,
    [activityDays, staleDays]
  )
  return rows.map((r) => ({ userId: Number(r.user_id), email: r.email ?? null }))
}

/** Date du dernier check-in (pour décider d'une relance). */
export async function getLastCheckinAt(userId: number): Promise<string | null> {
  if (!isDbConfigured()) return null
  await ensureCheckinsTable()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT created_at FROM ${TBL()} WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
    [userId]
  )
  return rows[0]?.created_at ? String(rows[0].created_at) : null
}
