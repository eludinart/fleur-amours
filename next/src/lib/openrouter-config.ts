/**
 * Configuration OpenRouter — source: .env (racine)
 * Modèle: OPENROUTER_MODEL ou FLEUR_OPENROUTER_MODEL
 */
export function getOpenRouterModel(): string {
  return (
    process.env.FLEUR_OPENROUTER_MODEL ||
    process.env.OPENROUTER_MODEL ||
    'stepfun/step-3.5-flash'
  )
}

export const DEFAULT_OPENROUTER_MODEL = 'stepfun/step-3.5-flash'
