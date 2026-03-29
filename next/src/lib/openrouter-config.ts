/**
 * Configuration OpenRouter — source: .env (racine)
 * Modèle: FLEUR_OPENROUTER_MODEL > OPENROUTER_MODEL > fallback économique
 *
 * Fallback : google/gemini-2.5-flash-lite (coût minimal, latence faible)
 */
export function getOpenRouterModel(): string {
  return (
    process.env.FLEUR_OPENROUTER_MODEL ||
    process.env.OPENROUTER_MODEL ||
    DEFAULT_OPENROUTER_MODEL
  )
}

export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash-lite'
