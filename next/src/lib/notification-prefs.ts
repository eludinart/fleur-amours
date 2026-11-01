/**
 * Préférences de notification (usermeta) — côté serveur.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import type { EngagementCampaignId } from './engagement-templates'
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_TOPICS,
  normalizeNotificationPrefs,
  type NotificationPrefs,
  type NotificationTopicKey,
} from './notification-prefs-types'

export {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_TOPICS,
  TOPIC_KEYS,
  normalizeNotificationPrefs,
  type NotificationPrefs,
  type NotificationTopicKey,
} from './notification-prefs-types'

export const PREFS_META_KEY = 'fleur_notification_prefs'

export async function readNotificationPrefs(userId: number): Promise<NotificationPrefs> {
  if (!isDbConfigured() || !userId) {
    return { ...DEFAULT_NOTIFICATION_PREFS, topics: { ...DEFAULT_TOPICS } }
  }
  const pool = getPool()
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, PREFS_META_KEY]
  )
  if (!rows?.length) return { ...DEFAULT_NOTIFICATION_PREFS, topics: { ...DEFAULT_TOPICS } }
  try {
    return normalizeNotificationPrefs(JSON.parse(String(rows[0].meta_value ?? '{}')))
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS, topics: { ...DEFAULT_TOPICS } }
  }
}

export async function writeNotificationPrefs(
  userId: number,
  prefs: NotificationPrefs
): Promise<void> {
  const pool = getPool()
  const tMeta = table('usermeta')
  const json = JSON.stringify(prefs)
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tMeta} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, PREFS_META_KEY]
  )
  if (existing?.length) {
    await pool.execute(`UPDATE ${tMeta} SET meta_value = ? WHERE umeta_id = ?`, [
      json,
      Number(existing[0].umeta_id),
    ])
  } else {
    await pool.execute(
      `INSERT INTO ${tMeta} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
      [userId, PREFS_META_KEY, json]
    )
  }
}

/** Mappe une campagne engagement vers une clé de préférence thématique. */
export function topicForCampaign(campaignId: EngagementCampaignId | string): NotificationTopicKey {
  switch (campaignId) {
    case 'carte_du_jour':
    case 'carte_dimanche':
    case 'serie_j2':
    case 'serie_j3':
    case 'tirage':
      return 'carte_du_jour'
    case 'plan14j':
    case 'plan14j_closing':
      return 'plan14j'
    case 'checkin':
    case 'checkin_echo':
      return 'checkin'
    case 'duo_same_petal':
      return 'social'
    case 'dreamscape':
    case 'session':
    case 'earlyreturn':
      return 'session_dreamscape'
    case 'fleur':
    case 'comeback':
      return 'carte_du_jour'
    default:
      return 'carte_du_jour'
  }
}

export function topicForNotificationType(type: string): NotificationTopicKey | null {
  const t = String(type || '')
  if (t.startsWith('engagement_')) return topicForCampaign(t.replace(/^engagement_/, ''))
  if (t === 'plan14j_reminder') return 'plan14j'
  if (t === 'checkin_reminder' || t === 'checkin_echo') return 'checkin'
  if (t.includes('social') || t.includes('prairie') || t.includes('grain')) return 'social'
  if (t.includes('coach') || t.includes('chat')) return 'coach'
  return null
}

export async function isTopicEnabled(
  userId: number,
  topic: NotificationTopicKey
): Promise<boolean> {
  const prefs = await readNotificationPrefs(userId)
  return prefs.topics[topic] !== false
}

export async function assertCampaignAllowed(
  userId: number,
  campaignId: EngagementCampaignId | string
): Promise<boolean> {
  return isTopicEnabled(userId, topicForCampaign(campaignId))
}
