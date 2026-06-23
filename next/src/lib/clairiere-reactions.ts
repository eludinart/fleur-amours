/** Emojis autorisés pour les réactions Clairière (partagé client / serveur). */
export const CLAIRIERE_REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🌸', '✨'] as const

export type MessageReactionSummary = {
  emoji: string
  count: number
  mine: boolean
}

export function isAllowedClairiereReactionEmoji(raw: string): boolean {
  const emoji = String(raw ?? '').trim()
  return (CLAIRIERE_REACTION_EMOJIS as readonly string[]).includes(emoji)
}
