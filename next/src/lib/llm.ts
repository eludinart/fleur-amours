/**
 * Point d'entrée unique pour les appels IA (OpenRouter ou Mistral).
 */
import type { AiProvider } from './ai-providers'
import type { AiTier } from './ai-tiers'
import { openrouterCall, type OpenRouterMessage, type OpenRouterOptions } from './openrouter'
import { mistralCall } from './mistral'
import {
  getAiRuntimeConfig,
  isActiveAiConfigured,
  isMistralKeyConfigured,
  isOpenRouterKeyConfigured,
  resolveModelForTier,
} from './db-ai-config'
import type { AiTaskId } from './ai-task-registry'
import { getAiTask } from './ai-task-registry'

export type LlmMessage = OpenRouterMessage
export type LlmOptions = OpenRouterOptions & { tier?: AiTier }

export type LlmCallMeta = {
  provider: AiProvider
  model: string
  tier: AiTier
}

/** Appel LLM selon le provider actif et le tier (DB admin > .env). */
export async function llmCall(
  system: string,
  messages: LlmMessage[],
  options: LlmOptions = {}
): Promise<Record<string, unknown> | string | null> {
  const tier = options.tier ?? 'standard'
  const cfg = await getAiRuntimeConfig()
  const model = await resolveModelForTier(tier, cfg)

  if (cfg.provider === 'mistral') {
    if (!isMistralKeyConfigured()) return null
    return mistralCall(system, messages, { ...options, model })
  }

  if (!isOpenRouterKeyConfigured()) return null
  return openrouterCall(system, messages, { ...options, model } as OpenRouterOptions & { model?: string })
}

/** Métadonnées du provider actif (pour logs / cache). */
export async function getLlmMeta(tier: AiTier = 'standard'): Promise<LlmCallMeta> {
  const cfg = await getAiRuntimeConfig()
  return {
    provider: cfg.provider,
    model: await resolveModelForTier(tier, cfg),
    tier,
  }
}

export async function isLlmConfigured(): Promise<boolean> {
  return isActiveAiConfigured()
}

/** Appel LLM avec tier imposé par le registre de tâches. */
export async function llmCallForTask(
  taskId: AiTaskId,
  system: string,
  messages: LlmMessage[],
  options: Omit<LlmOptions, 'tier'> = {}
): Promise<Record<string, unknown> | string | null> {
  return llmCall(system, messages, { ...options, tier: getAiTask(taskId).tier })
}

export async function getLlmMetaForTask(taskId: AiTaskId): Promise<LlmCallMeta> {
  return getLlmMeta(getAiTask(taskId).tier)
}

/** @deprecated Préférer isLlmConfigured() */
export function isOpenRouterEnvConfigured(): boolean {
  return isOpenRouterKeyConfigured()
}
