/** Comptes fictifs créés par le seed Mycelium (simulation RH / salariés). */

export const DEMO_ACCOUNT_META_KEY = 'fleur_demo_account'
export const DEMO_EMAIL_DOMAIN = 'demo-littoral.eludein.art'

export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.trim().toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`)
}

export function isDemoAccount(params: {
  email?: string | null
  demoMeta?: string | null | undefined
}): boolean {
  const meta = params.demoMeta != null ? String(params.demoMeta).trim() : ''
  if (meta === '1' || meta.toLowerCase() === 'true') return true
  return isDemoEmail(params.email)
}
