/** Emojis fleur proposés pour l'avatar social (profil / prairie). */
export const FLOWER_EMOJIS = [
  '🌸',
  '🌺',
  '🌻',
  '🌷',
  '🌹',
  '💐',
  '🪷',
  '🪻',
  '🌼',
  '🏵️',
  '🌿',
  '🍀',
  '🥀',
  '💮',
  '🌾',
]

/** Intentions d'arrivée dans le Jardin (aligné sur les graines sociales). */
export const JARDIN_INTENTION_IDS = [
  'resonance',
  'eclairage',
  'ludus',
  'philia',
  'agape',
] as const

export type JardinIntentionId = (typeof JARDIN_INTENTION_IDS)[number]
