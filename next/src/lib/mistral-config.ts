/** Configuration Mistral — source : .env + override admin (db-ai-config). */
import type { AiTier } from './ai-tiers'

export const DEFAULT_MISTRAL_MODEL = 'mistral-small-latest'

export const MISTRAL_TIER_DEFAULTS: Record<AiTier, string> = {
  light: 'mistral-small-latest',
  standard: 'mistral-small-latest',
  premium: 'mistral-large-latest',
}

export function getMistralModelFromEnv(): string {
  return (
    process.env.FLEUR_MISTRAL_MODEL?.trim() ||
    process.env.MISTRAL_MODEL?.trim() ||
    DEFAULT_MISTRAL_MODEL
  )
}

export function getMistralModelForTier(tier: AiTier): string {
  const envKey = `MISTRAL_MODEL_${tier.toUpperCase()}` as const
  const fleurKey = `FLEUR_MISTRAL_MODEL_${tier.toUpperCase()}` as const
  return (
    process.env[fleurKey]?.trim() ||
    process.env[envKey]?.trim() ||
    MISTRAL_TIER_DEFAULTS[tier]
  )
}
