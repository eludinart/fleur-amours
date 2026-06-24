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
