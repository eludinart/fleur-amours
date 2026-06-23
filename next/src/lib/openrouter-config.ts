/**
 * Configuration OpenRouter — source: .env (racine)
 * Modèle: FLEUR_OPENROUTER_MODEL > OPENROUTER_MODEL > fallback économique
 *
 * Fallback : google/gemini-2.5-flash-lite (coût minimal, latence faible)
 */
import type { AiTier } from './ai-tiers'

export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash-lite'

export const OPENROUTER_TIER_DEFAULTS: Record<AiTier, string> = {
  light: 'google/gemini-2.5-flash-lite',
  standard: 'google/gemini-2.5-flash-lite',
  premium: 'google/gemini-2.5-flash',
}

export function getOpenRouterModel(): string {
  return (
    process.env.FLEUR_OPENROUTER_MODEL ||
    process.env.OPENROUTER_MODEL ||
    DEFAULT_OPENROUTER_MODEL
  )
}

export function getOpenRouterModelForTier(tier: AiTier): string {
  const envKey = `OPENROUTER_MODEL_${tier.toUpperCase()}` as const
  const fleurKey = `FLEUR_OPENROUTER_MODEL_${tier.toUpperCase()}` as const
  return (
    process.env[fleurKey]?.trim() ||
    process.env[envKey]?.trim() ||
    OPENROUTER_TIER_DEFAULTS[tier]
  )
}
