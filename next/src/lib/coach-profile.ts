/** Profil public coach (API / liste accompagnants) */

export type Coach = {
  id: number
  email: string
  name: string
  /** Pseudo public Mon compte (fleur_pseudo), ex. eric_admin */
  pseudo?: string
  avatar?: string
  avatar_emoji?: string
  coach_headline?: string
  coach_short_bio?: string
  coach_long_bio?: string
  coach_specialties?: string[]
  coach_languages?: string[]
  coach_response_time_label?: string
  coach_response_time_hours?: number
  coach_years_experience?: number
  coach_reviews_label?: string
  coach_verified?: boolean
  is_online?: boolean
  last_seen_at?: string | null
}

type TFn = (key: string, vars?: Record<string, string | number>) => string

export function formatCoachLastSeenLabel(iso: string | null | undefined, tf: TFn): string {
  if (!iso || !String(iso).trim()) return tf('chat.lastSeenUnknown')
  const s = String(iso).trim()
  let ts: number
  // Stored format from our code: 'YYYY-MM-DD HH:mm:ss' (UTC without timezone marker)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    ts = new Date(s.replace(' ', 'T') + 'Z').getTime()
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    ts = new Date(s + 'Z').getTime()
  } else {
    ts = new Date(s).getTime()
  }
  if (Number.isNaN(ts)) return tf('chat.lastSeenUnknown')
  const sec = Math.max(0, (Date.now() - ts) / 1000)
  const min = Math.floor(sec / 60)
  if (min < 1) return tf('chat.lastSeenMinutes', { n: 1 })
  if (min < 60) return tf('chat.lastSeenMinutes', { n: min })
  const h = Math.floor(min / 60)
  if (h < 48) return tf('chat.lastSeenHours', { n: h })
  const d = Math.floor(h / 24)
  return tf('chat.lastSeenDays', { n: Math.max(1, d) })
}

/** Nom affiché WordPress (display_name) ou repli sur email */
export function coachProfileDisplayName(c: Coach | null | undefined): string {
  if (!c) return ''
  const n = (c.name || '').trim()
  if (n) return n
  const mail = (c.email || '').trim()
  if (mail) {
    const local = mail.split('@')[0] || ''
    return local.replace(/[._-]+/g, ' ').trim() || mail
  }
  return ''
}

export function coachPseudoHandle(c: Coach | null | undefined): string {
  if (!c) return ''
  const p = (c.pseudo || '').trim().replace(/^@+/, '').toLowerCase()
  return p
}

/** Titre principal : @pseudo si renseigné, sinon nom affiché / email */
export function coachPrimaryTitle(c: Coach | null | undefined): string {
  const handle = coachPseudoHandle(c)
  if (handle) return `@${handle}`
  return coachProfileDisplayName(c)
}

/** Sous-titre sous le titre (nom civil / accroche) */
export function coachSubtitleUnderTitle(c: Coach | null | undefined): string {
  if (!c) return ''
  const handle = coachPseudoHandle(c)
  const name = (c.name || '').trim()
  if (handle && name && name.toLowerCase() !== handle) return name
  if (c.coach_headline?.trim()) return c.coach_headline.trim()
  return ''
}
