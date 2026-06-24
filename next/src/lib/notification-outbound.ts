/**
 * Garde-fou envoi notifications / e-mails en développement.
 */
const DEV_EMAIL = String(process.env.DEV_NOTIFICATION_EMAIL ?? 'eludinart@gmail.com')
  .trim()
  .toLowerCase()

export function isNotificationOutboundRestricted(): boolean {
  if (process.env.NOTIFICATIONS_DEV_ONLY === 'false') return false
  if (process.env.NOTIFICATIONS_DEV_ONLY === 'true') return true
  return process.env.NODE_ENV !== 'production'
}

export function devNotificationEmail(): string {
  return DEV_EMAIL
}

export function normalizeOutboundEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase()
}

/** Liste d'e-mails autorisés pour les relances engagement (cron). Vide = pas de filtre allowlist. */
export function parseEmailAllowlist(raw: string | undefined): Set<string> | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const set = new Set(
    s.split(/[,;\s]+/).map(normalizeOutboundEmail).filter(Boolean)
  )
  return set.size > 0 ? set : null
}

export function engagementRemindAllowlist(): Set<string> | null {
  return parseEmailAllowlist(process.env.ENGAGEMENT_REMIND_ALLOWLIST)
}

export function isEngagementRemindAllowlistActive(): boolean {
  return engagementRemindAllowlist() !== null
}

/** Filtre cron engagement : allowlist si définie, sinon garde-fou dev habituel. */
export function canSendEngagementRemindToEmail(
  email: string,
  options?: { skipDevGuard?: boolean }
): boolean {
  const list = engagementRemindAllowlist()
  if (list) {
    return list.has(normalizeOutboundEmail(email))
  }
  return canSendOutboundToEmail(email, options)
}

/** En dev : ne livrer qu'à l'adresse de test. */
export function filterOutboundRecipients<T extends { user_id: number; email: string }>(
  recipients: T[],
  options?: { skipDevGuard?: boolean }
): T[] {
  if (options?.skipDevGuard || !isNotificationOutboundRestricted()) return recipients
  const allowed = DEV_EMAIL
  return recipients.filter((r) => normalizeOutboundEmail(r.email) === allowed)
}

export function canSendOutboundToEmail(email: string, options?: { skipDevGuard?: boolean }): boolean {
  if (options?.skipDevGuard || !isNotificationOutboundRestricted()) return true
  return normalizeOutboundEmail(email) === DEV_EMAIL
}
