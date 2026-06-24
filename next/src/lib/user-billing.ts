/**
 * Politique freemium / abonnement / exemption staff — source unique des limites.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import { ensurePromoTables } from './db-promo-access'
import { cacheDel } from './server-cache'

export const BILLING_BYPASS_META_KEY = 'fleur_billing_bypass'

/** Sève Sablier offerte à la première création du compte (juste milieu acquisition / monétisation). */
export const FREE_DEFAULT_SAP = 30

/** Quotas mensuels freemium (utilisateur sans abo ni promo illimitée). */
export const FREEMIUM_LIMITS = {
  chat_messages_per_month: 5,
  sessions_per_month: 2,
  tirages_per_month: 3,
  fleur_submits_per_month: 2,
} as const

/** Quotas mensuels abonné / promo illimitée (usage régulier confortable). */
export const SUBSCRIBER_LIMITS = {
  chat_messages_per_month: 25,
  sessions_per_month: 8,
  tirages_per_month: 12,
  fleur_submits_per_month: 5,
} as const

export type UserBillingFlags = {
  billingBypass: boolean
  hasFullAccess: boolean
  hasPromoAccess: boolean
  unlimited: boolean
  freeUntil: string | null
  hasSubscription: boolean
  subType: string | null
}

export type MonthlyLimits = {
  chat_messages_per_month: number
  sessions_per_month: number
  tirages_per_month: number
  fleur_submits_per_month: number
}

export function limitsForUser(flags: UserBillingFlags, bonus?: Partial<MonthlyLimits>): MonthlyLimits {
  const base = flags.hasFullAccess ? SUBSCRIBER_LIMITS : FREEMIUM_LIMITS
  return {
    chat_messages_per_month: base.chat_messages_per_month + (bonus?.chat_messages_per_month ?? 0),
    sessions_per_month: base.sessions_per_month + (bonus?.sessions_per_month ?? 0),
    tirages_per_month: base.tirages_per_month + (bonus?.tirages_per_month ?? 0),
    fleur_submits_per_month: base.fleur_submits_per_month + (bonus?.fleur_submits_per_month ?? 0),
  }
}

/** true = pas de débit SAP côté client ni serveur (staff ou accès illimité). */
export function skipsSapCharges(flags: UserBillingFlags): boolean {
  return flags.billingBypass || flags.hasFullAccess
}

export async function readBillingBypass(userId: number): Promise<boolean> {
  if (!isDbConfigured() || userId <= 0) return false
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${table('usermeta')} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, BILLING_BYPASS_META_KEY]
  )
  const v = rows[0]?.meta_value != null ? String(rows[0].meta_value).trim() : ''
  return v === '1' || v.toLowerCase() === 'true'
}

export async function resolveUserBilling(userId: number): Promise<UserBillingFlags> {
  const base: UserBillingFlags = {
    billingBypass: false,
    hasFullAccess: false,
    hasPromoAccess: false,
    unlimited: false,
    freeUntil: null,
    hasSubscription: false,
    subType: null,
  }
  if (!isDbConfigured() || userId <= 0) return base

  base.billingBypass = await readBillingBypass(userId)
  if (base.billingBypass) {
    base.hasFullAccess = true
    return base
  }

  const pool = getPool()
  await ensurePromoTables(pool)

  const [promoRows] = await pool.execute<RowDataPacket[]>(
    `SELECT unlimited, free_until FROM ${table('fleur_promo_redemptions')}
     WHERE user_id = ? AND active = 1
     ORDER BY redeemed_at DESC LIMIT 1`,
    [userId]
  )
  const promo = promoRows[0]
  if (promo) {
    const unlimited = Boolean(promo.unlimited)
    const freeUntil = promo.free_until ? new Date(promo.free_until).toISOString() : null
    const stillValid =
      unlimited || (freeUntil != null && new Date(freeUntil).getTime() > Date.now())
    if (stillValid) {
      base.hasPromoAccess = true
      base.unlimited = unlimited
      base.freeUntil = freeUntil
      if (unlimited) base.hasFullAccess = true
    }
  }

  try {
    const [accessRows] = await pool.execute<RowDataPacket[]>(
      `SELECT sub_type FROM ${table('fleur_users_access')} WHERE user_id = ? LIMIT 1`,
      [userId]
    )
    const subType = accessRows[0]?.sub_type ? String(accessRows[0].sub_type) : null
    base.subType = subType
    if (subType && subType !== 'free' && subType !== '') {
      base.hasSubscription = true
      base.hasFullAccess = true
    }
  } catch {
    /* ignore */
  }

  return base
}

export function invalidateUserAccessCache(userId: number): void {
  if (userId > 0) cacheDel(`user_access:${userId}`)
}
