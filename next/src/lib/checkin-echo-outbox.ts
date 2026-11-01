/**
 * Écho check-in : si mood/tension extrêmes 2 jours de suite → relance J+1.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import { loadEngagementPersonalization } from './engagement-context'
import { sendEngagementNotification } from './send-engagement-notification'
import { assertCampaignAllowed } from './notification-prefs'

const MOOD_LOW = 35
const MOOD_HIGH = 75
const TENSION_HIGH = 70

export async function maybeQueueCheckinEcho(userId: number, email: string | null): Promise<boolean> {
  if (!isDbConfigured() || !userId || !email) return false
  if (!(await assertCampaignAllowed(userId, 'checkin_echo'))) return false

  const pool = getPool()
  const t = table('fleur_checkins')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT mood, tension, DATE(created_at) AS d
       FROM ${t}
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 5`,
    [userId]
  )
  if (!rows || rows.length < 2) return false

  const extreme = (r: RowDataPacket) => {
    const mood = Number(r.mood)
    const tension = Number(r.tension)
    return mood <= MOOD_LOW || mood >= MOOD_HIGH || tension >= TENSION_HIGH
  }

  // Deux jours calendaires distincts, les plus récents
  const byDay = new Map<string, RowDataPacket>()
  for (const r of rows) {
    const d = String(r.d)
    if (!byDay.has(d)) byDay.set(d, r)
  }
  const days = [...byDay.keys()].slice(0, 2)
  if (days.length < 2) return false
  const a = byDay.get(days[0])!
  const b = byDay.get(days[1])!
  if (!extreme(a) || !extreme(b)) return false

  // Pas plus d'un écho / 7 jours
  const tN = table('fleur_notifications')
  const tD = table('fleur_notification_deliveries')
  const [recent] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM ${tD} d
      INNER JOIN ${tN} n ON n.id = d.notification_id
      WHERE d.user_id = ? AND n.type = 'checkin_echo'
        AND d.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      LIMIT 1`,
    [userId]
  )
  if (recent?.length) return false

  const personalization = await loadEngagementPersonalization(userId, email)
  const result = await sendEngagementNotification({
    userId,
    email,
    campaignId: 'checkin_echo',
    personalization,
    skipDevGuard: false,
  })
  return result.sent
}
