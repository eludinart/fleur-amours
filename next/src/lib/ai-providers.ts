/** Providers IA supportés par Fleur d'AmOurs. */

export const AI_PROVIDERS = ['openrouter', 'mistral'] as const
export type AiProvider = (typeof AI_PROVIDERS)[number]

export function isAiProvider(v: unknown): v is AiProvider {
  return typeof v === 'string' && (AI_PROVIDERS as readonly string[]).includes(v)
}

export function aiProviderLabel(provider: AiProvider): string {
  return provider === 'mistral' ? 'Mistral AI' : 'OpenRouter'
}
