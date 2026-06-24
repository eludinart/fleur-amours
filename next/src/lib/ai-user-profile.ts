/**
 * Profil IA utilisateur — promo, abonnement, solde SAP, exemption staff.
 */
import { getPool, isDbConfigured } from './db'
import { readLegacySapSum } from './db-sap'
import { resolveUserBilling } from './user-billing'

export type UserAiProfile = {
  userId: number
  hasFullAccess: boolean
  hasPromoAccess: boolean
  unlimited: boolean
  freeUntil: string | null
  sapBalance: number
  subType: string | null
  billingBypass: boolean
}

export async function loadUserAiProfile(userId: number): Promise<UserAiProfile> {
  const billing = await resolveUserBilling(userId)
  const base: UserAiProfile = {
    userId,
    hasFullAccess: billing.hasFullAccess,
    hasPromoAccess: billing.hasPromoAccess,
    unlimited: billing.unlimited,
    freeUntil: billing.freeUntil,
    sapBalance: 0,
    subType: billing.subType,
    billingBypass: billing.billingBypass,
  }
  if (!isDbConfigured()) return base

  base.sapBalance = await readLegacySapSum(getPool(), userId)
  return base
}
