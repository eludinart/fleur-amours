/**
 * Types / défauts des préférences notification — safe client (pas de mysql).
 */

export type NotificationTopicKey =
  | 'carte_du_jour'
  | 'plan14j'
  | 'checkin'
  | 'social'
  | 'coach'
  | 'session_dreamscape'

export type NotificationPrefs = {
  in_app_enabled: boolean
  email_enabled: boolean
  email_digest: string
  quiet_hours_start: number | null
  quiet_hours_end: number | null
  topics: Record<NotificationTopicKey, boolean>
}

export const TOPIC_KEYS: NotificationTopicKey[] = [
  'carte_du_jour',
  'plan14j',
  'checkin',
  'social',
  'coach',
  'session_dreamscape',
]

export const DEFAULT_TOPICS: Record<NotificationTopicKey, boolean> = {
  carte_du_jour: true,
  plan14j: true,
  checkin: true,
  social: true,
  coach: true,
  session_dreamscape: true,
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  in_app_enabled: true,
  email_enabled: true,
  email_digest: 'instant',
  quiet_hours_start: null,
  quiet_hours_end: null,
  topics: { ...DEFAULT_TOPICS },
}

const DIGEST_VALUES = new Set(['instant', 'daily', 'weekly', 'never'])

function clampHour(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = parseInt(String(v), 10)
  if (!Number.isFinite(n)) return null
  return Math.min(Math.max(n, 0), 23)
}

function normalizeTopics(raw: unknown): Record<NotificationTopicKey, boolean> {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const out = { ...DEFAULT_TOPICS }
  for (const key of TOPIC_KEYS) {
    if (Object.prototype.hasOwnProperty.call(src, key)) {
      out[key] = src[key] !== false
    }
  }
  return out
}

export function normalizeNotificationPrefs(raw: Record<string, unknown>): NotificationPrefs {
  return {
    in_app_enabled: raw.in_app_enabled !== false,
    email_enabled: raw.email_enabled !== false,
    email_digest: DIGEST_VALUES.has(String(raw.email_digest))
      ? String(raw.email_digest)
      : 'instant',
    quiet_hours_start: clampHour(raw.quiet_hours_start),
    quiet_hours_end: clampHour(raw.quiet_hours_end),
    topics: normalizeTopics(raw.topics),
  }
}
