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

/** Fragment SQL — exclut les comptes démo Mycelium des espaces Fleur d'Amour (prairie, social, admin). */
export function excludeDemoAccountsSql(usersAlias: string, metaTable: string): string {
  return `AND LOWER(${usersAlias}.user_email) NOT LIKE '%@${DEMO_EMAIL_DOMAIN}'
    AND NOT EXISTS (
      SELECT 1 FROM ${metaTable} _dm_excl
      WHERE _dm_excl.user_id = ${usersAlias}.ID
        AND _dm_excl.meta_key = '${DEMO_ACCOUNT_META_KEY}'
        AND _dm_excl.meta_value IN ('1', 'true')
    )`
}
