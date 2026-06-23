/**
 * Salons pétales — 8 espaces publics légers (1 par pétale d'amour).
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getPool, table } from './db'
import { PETAL_IDS } from './grand-jardin-view'

const VALID_SALONS = new Set<string>(PETAL_IDS)
const MAX_BODY = 500
const DAILY_MSG_LIMIT = 8

let _ensureSalonPromise: Promise<void> | null = null

async function ensureSalonTable(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  if (!_ensureSalonPromise) {
    const t = table('fleur_salon_messages')
    _ensureSalonPromise = pool
      .execute(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        salon_id VARCHAR(20) NOT NULL,
        user_id INT NOT NULL,
        body VARCHAR(520) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_salon (salon_id, created_at),
        INDEX idx_user_day (user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
      .then(() => undefined)
      .catch(() => {
        _ensureSalonPromise = null
      })
  }
  return _ensureSalonPromise
}

async function assertProfilePublic(userId: number): Promise<void> {
  const pool = getPool()
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = 'fleur_profile_public' LIMIT 1`,
    [userId]
  )
  if (String(rows?.[0]?.meta_value ?? '') !== '1') {
    const err = new Error('Activez votre profil public pour participer aux salons.') as Error & {
      code?: string
    }
    err.code = 'profile_not_public'
    throw err
  }
}

async function countUserMessagesToday(userId: number): Promise<number> {
  const pool = getPool()
  await ensureSalonTable(pool)
  const t = table('fleur_salon_messages')
  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM ${t} WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
      [userId]
    )
    return Number(r?.[0]?.c ?? 0)
  } catch {
    return 0
  }
}

export type SalonMessage = {
  id: number
  salonId: string
  userId: number
  pseudo: string
  avatarEmoji: string
  body: string
  createdAt: string
}

export type SalonSummary = {
  salonId: string
  messagesToday: number
  lastMessageAt: string | null
}

export async function listSalonSummaries(): Promise<SalonSummary[]> {
  const pool = getPool()
  await ensureSalonTable(pool)
  const t = table('fleur_salon_messages')
  const summaries: SalonSummary[] = PETAL_IDS.map((id) => ({
    salonId: id,
    messagesToday: 0,
    lastMessageAt: null,
  }))
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT salon_id,
              SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today_count,
              MAX(created_at) AS last_at
       FROM ${t}
       WHERE created_at >= (NOW() - INTERVAL 7 DAY)
       GROUP BY salon_id`
    )
    const byId = new Map(
      (rows ?? []).map((r) => [
        String(r.salon_id),
        {
          messagesToday: Number(r.today_count ?? 0),
          lastMessageAt: r.last_at ? String(r.last_at) : null,
        },
      ])
    )
    return summaries.map((s) => {
      const agg = byId.get(s.salonId)
      return agg ? { ...s, ...agg } : s
    })
  } catch {
    return summaries
  }
}

export async function getSalonMessages(
  salonId: string,
  limit = 50
): Promise<SalonMessage[]> {
  const pool = getPool()
  await ensureSalonTable(pool)
  const sid = String(salonId ?? '').trim()
  if (!VALID_SALONS.has(sid)) return []

  const t = table('fleur_salon_messages')
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const lim = Math.min(80, Math.max(1, limit))

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT m.id, m.salon_id, m.user_id, m.body, m.created_at,
              u.display_name,
              COALESCE(ump.meta_value, '') AS pseudo,
              COALESCE(ume.meta_value, '🌸') AS avatar_emoji
       FROM ${t} m
       LEFT JOIN ${tUsers} u ON u.ID = m.user_id
       LEFT JOIN ${tMeta} ump ON ump.user_id = m.user_id AND ump.meta_key = 'fleur_pseudo'
       LEFT JOIN ${tMeta} ume ON ume.user_id = m.user_id AND ume.meta_key = 'fleur_avatar_emoji'
       WHERE m.salon_id = ?
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [sid, lim]
    )
    return (rows ?? [])
      .reverse()
      .map((r) => ({
        id: Number(r.id),
        salonId: String(r.salon_id),
        userId: Number(r.user_id),
        pseudo:
          String(r.pseudo ?? '').trim() ||
          String(r.display_name ?? '').trim() ||
          `jardinier_${Buffer.from(String(r.user_id)).toString('hex').slice(0, 6)}`,
        avatarEmoji: String(r.avatar_emoji ?? '🌸').trim() || '🌸',
        body: String(r.body),
        createdAt: String(r.created_at ?? ''),
      }))
  } catch {
    return []
  }
}

export async function postSalonMessage(
  userId: number,
  salonId: string,
  body: string
): Promise<SalonMessage> {
  const pool = getPool()
  await ensureSalonTable(pool)
  await assertProfilePublic(userId)

  const sid = String(salonId ?? '').trim()
  if (!VALID_SALONS.has(sid)) {
    const err = new Error('Salon invalide') as Error & { code?: string }
    err.code = 'invalid_salon'
    throw err
  }

  const todayCount = await countUserMessagesToday(userId)
  if (todayCount >= DAILY_MSG_LIMIT) {
    const err = new Error('Limite de 8 messages par jour dans les salons.') as Error & { code?: string }
    err.code = 'salon_daily_limit'
    throw err
  }

  const text = String(body ?? '').trim().slice(0, MAX_BODY)
  if (text.length < 4) {
    const err = new Error('Message trop court (4 caractères min).') as Error & { code?: string }
    err.code = 'body_too_short'
    throw err
  }

  const t = table('fleur_salon_messages')
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${t} (salon_id, user_id, body) VALUES (?, ?, ?)`,
    [sid, userId, text]
  )

  const messages = await getSalonMessages(sid, 1)
  const last = messages[messages.length - 1]
  if (last) return last

  return {
    id: Number(result.insertId),
    salonId: sid,
    userId,
    pseudo: '',
    avatarEmoji: '🌸',
    body: text,
    createdAt: new Date().toISOString(),
  }
}

export async function getSalonPostStatus(userId: number): Promise<{
  remainingToday: number
  dailyLimit: number
}> {
  const used = await countUserMessagesToday(userId)
  return { remainingToday: Math.max(0, DAILY_MSG_LIMIT - used), dailyLimit: DAILY_MSG_LIMIT }
}
