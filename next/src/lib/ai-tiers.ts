/** Tiers de modèle IA — choisis côté serveur, jamais par le client. */
export type AiTier = 'light' | 'standard' | 'premium'

export type AiOutputMode = 'json' | 'markdown' | 'raw'

/** Domaine du prompt système (noyau Fleur réservé au jardin). */
export type AiDomain = 'fleur' | 'mycelium' | 'none'

export const AI_TIERS: AiTier[] = ['light', 'standard', 'premium']
