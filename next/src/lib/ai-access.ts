/**
 * Résolution d'accès IA — tier, SAP, quotas freemium.
 */
import type { AiTier } from './ai-tiers'
import type { AiTaskId } from './ai-task-registry'
import { getAiTask } from './ai-task-registry'
import { loadUserAiProfile, type UserAiProfile } from './ai-user-profile'
import { readMonthlyUsage, incrementUsage, type UsageKey } from './db-usage'
import { checkAiRateLimit } from './ai-rate-limit'

export type AiBillingMode = 'free' | 'full_access' | 'sap' | 'admin' | 'staff' | 'denied'

export type AiAccessResult = {
  allowed: boolean
  tier: AiTier
  taskId: AiTaskId
  billingMode: AiBillingMode
  sapCost: number
  requiresSap: boolean
  canUseFallback: boolean
  reason?: string
  code?: 'ADMIN_ONLY' | 'PREMIUM_LOCKED' | 'INSUFFICIENT_SAP' | 'QUOTA_EXCEEDED' | 'RATE_LIMITED'
  profile?: UserAiProfile
}

export type ResolveAiAccessOptions = {
  force?: boolean
  isAdmin?: boolean
  /** Lecture cache uniquement — pas de génération. */
  cacheOnly?: boolean
}

export async function resolveAiAccess(
  userId: number | null,
  taskId: AiTaskId,
  opts: ResolveAiAccessOptions = {}
): Promise<AiAccessResult> {
  const task = getAiTask(taskId)
  const base: AiAccessResult = {
    allowed: false,
    tier: task.tier,
    taskId,
    billingMode: 'denied',
    sapCost: task.sapCost,
    requiresSap: task.sapCost > 0,
    canUseFallback: taskId === 'tuteur',
  }

  if (opts.cacheOnly && task.cacheReadable) {
    return { ...base, allowed: true, billingMode: 'free', reason: 'cache_read' }
  }

  if (task.adminOnly && !opts.isAdmin) {
    return { ...base, code: 'ADMIN_ONLY', reason: 'Réservé aux administrateurs.' }
  }

  if (userId == null) {
    return { ...base, code: 'PREMIUM_LOCKED', reason: 'Authentification requise.' }
  }

  const profile = await loadUserAiProfile(userId)
  const withProfile = { ...base, profile }

  if (profile.billingBypass) {
    return { ...withProfile, allowed: true, billingMode: 'staff' }
  }

  if (opts.isAdmin && task.adminOnly) {
    return { ...withProfile, allowed: true, billingMode: 'admin' }
  }

  if (profile.hasFullAccess) {
    return { ...withProfile, allowed: true, billingMode: 'full_access' }
  }

  // Mycelium RH : pas de facturation SAP utilisateur
  if (taskId === 'mycelium-synthesis') {
    return { ...withProfile, allowed: true, billingMode: 'free' }
  }

  if (task.tier === 'light' && task.freeTierAllowed) {
    const rate = checkAiRateLimit(userId, taskId, task.hourlyLimit)
    if (rate.limited) {
      return {
        ...withProfile,
        code: 'RATE_LIMITED',
        reason: `Limite horaire atteinte (${task.hourlyLimit}/h). Réessayez dans ${rate.retryAfterSec}s.`,
      }
    }

    if (task.monthlyFreeQuota > 0) {
      const usage = await readMonthlyUsage(userId)
      const used = usage.ai_light_calls_count ?? 0
      if (used >= task.monthlyFreeQuota) {
        return {
          ...withProfile,
          code: 'QUOTA_EXCEEDED',
          reason: `Quota mensuel IA léger atteint (${task.monthlyFreeQuota}). Activez un code promo ou utilisez de la Sève.`,
        }
      }
    }

    return { ...withProfile, allowed: true, billingMode: 'free' }
  }

  // Premium : génération payante ou bloquée
  if (task.tier === 'premium' && !task.freeTierAllowed) {
    if (opts.force && task.sapCost > 0) {
      if (profile.sapBalance >= task.sapCost) {
        return { ...withProfile, allowed: true, billingMode: 'sap', requiresSap: true }
      }
      return {
        ...withProfile,
        code: 'INSUFFICIENT_SAP',
        reason: `Sève insuffisante (${task.sapCost} requis, ${profile.sapBalance} disponible).`,
        canUseFallback: taskId === 'tuteur',
      }
    }

    if (task.sapCost > 0 && profile.sapBalance >= task.sapCost) {
      return { ...withProfile, allowed: true, billingMode: 'sap', requiresSap: true }
    }

    return {
      ...withProfile,
      code: 'PREMIUM_LOCKED',
      reason:
        'Cette fonctionnalité premium nécessite de la Sève ou un accès promo. La relecture du cache reste disponible.',
      canUseFallback: taskId === 'tuteur',
    }
  }

  return { ...withProfile, allowed: true, billingMode: 'free' }
}

/** Incrémente le compteur mensuel après un appel léger réussi. */
export async function recordLightAiUsage(userId: number): Promise<void> {
  await incrementUsage(userId, 'ai_light_calls' as UsageKey)
}
