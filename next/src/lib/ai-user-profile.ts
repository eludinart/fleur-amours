/**
 * Profil IA utilisateur — promo, abonnement, solde SAP.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import { ensurePromoTables } from './db-promo-access'
import { readLegacySapSum } from './db-sap'

export type UserAiProfile = {
  userId: number
  hasFullAccess: boolean
  hasPromoAccess: boolean
  unlimited: boolean
  freeUntil: string | null
  sapBalance: number
  subType: string | null
}

export async function loadUserAiProfile(userId: number): Promise<UserAiProfile> {
  const base: UserAiProfile = {
    userId,
    hasFullAccess: false,
    hasPromoAccess: false,
    unlimited: false,
    freeUntil: null,
    sapBalance: 0,
    subType: null,
  }
  if (!isDbConfigured()) return base

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
      base.hasFullAccess = unlimited
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
      base.hasFullAccess = true
    }
  } catch {
    /* ignore */
  }

  base.sapBalance = await readLegacySapSum(pool, userId)
  return base
}
