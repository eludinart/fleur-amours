/**
 * Fil de sève — présence journalière (check-in OU tirage OU session OU dreamscape).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'

function parisDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function shiftParisDays(daysBack: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - daysBack)
  return parisDateKey(d)
}

async function ensurePresenceTable(): Promise<string> {
  const t = table('fleur_presence_days')
  const pool = getPool()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${t} (
      user_id INT NOT NULL,
      day_key CHAR(10) NOT NULL,
      sources VARCHAR(64) NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, day_key),
      INDEX idx_user_day (user_id, day_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  return t
}

export type PresenceSource = 'checkin' | 'tirage' | 'session' | 'dreamscape'

/** Enregistre une présence pour aujourd'hui (Paris). Idempotent. */
export async function recordPresenceDay(
  userId: number,
  source: PresenceSource
): Promise<void> {
  if (!isDbConfigured() || !userId) return
  const t = await ensurePresenceTable()
  const pool = getPool()
  const day = parisDateKey()
  await pool.execute(
    `INSERT INTO ${t} (user_id, day_key, sources) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE sources = IF(FIND_IN_SET(?, sources), sources, CONCAT_WS(',', NULLIF(sources,''), ?))`,
    [userId, day, source, source, source]
  )
}

export type PresenceStreak = {
  current: number
  today: boolean
  badge7: boolean
}

export async function getPresenceStreak(userId: number): Promise<PresenceStreak> {
  if (!isDbConfigured() || !userId) return { current: 0, today: false, badge7: false }
  const t = await ensurePresenceTable()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT day_key FROM ${t} WHERE user_id = ? ORDER BY day_key DESC LIMIT 60`,
    [userId]
  )
  const keys = new Set((rows ?? []).map((r) => String(r.day_key)))
  const today = parisDateKey()
  const todayPresent = keys.has(today)
  let streak = 0
  // Compte en arrière depuis hier si aujourd'hui absent, sinon depuis aujourd'hui
  let offset = todayPresent ? 0 : 1
  for (let i = 0; i < 60; i++) {
    const key = shiftParisDays(offset + i)
    // shiftParisDays uses UTC shift — approximate; better iterate from known keys
    if (!keys.has(key) && i === 0 && !todayPresent) {
      /* start from yesterday via list */
    }
  }
  // Calcul fiable : parcours jour par jour depuis aujourd'hui/hier
  const start = todayPresent ? 0 : 1
  for (let i = start; i < 90; i++) {
    const d = new Date()
    // Midnight Paris approximation via en-CA format of Date shifted
    const probe = new Date(Date.now() - i * 86400000)
    const key = parisDateKey(probe)
    if (keys.has(key)) streak++
    else break
  }
  return {
    current: streak,
    today: todayPresent,
    badge7: streak >= 7,
  }
}
