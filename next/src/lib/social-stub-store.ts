/**
 * Stockage en mémoire pour les messages du chat P2P en mode stub (sans DB).
 */
import { isAllowedClairiereReactionEmoji } from './clairiere-reactions'

export type StubMessage = {
  id: number
  senderId: number
  body: string | null
  cardSlug: string | null
  temperature: string
  createdAt: string
  reactions?: Array<{ emoji: string; count: number; mine: boolean }>
}

const messagesByChannel = new Map<number, StubMessage[]>()
const reactionsByMessage = new Map<number, Map<string, Set<number>>>()
/** userId → { channelId, at } — canal actuellement ouvert à l'écran */
const viewingByUser = new Map<number, { channelId: number; at: number }>()

const STUB_VIEWING_SECONDS = 35

function reactionsForMessage(messageId: number, currentUserId: number): Array<{ emoji: string; count: number; mine: boolean }> {
  const byEmoji = reactionsByMessage.get(messageId)
  if (!byEmoji) return []
  return Array.from(byEmoji.entries()).map(([emoji, users]) => ({
    emoji,
    count: users.size,
    mine: users.has(currentUserId),
  }))
}

export function addStubMessage(channelId: number, msg: StubMessage): void {
  const list = messagesByChannel.get(channelId) || []
  messagesByChannel.set(channelId, [...list, msg])
}

export function getStubMessages(channelId: number, currentUserId = 0): StubMessage[] {
  return (messagesByChannel.get(channelId) || []).map((m) => ({
    ...m,
    reactions: reactionsForMessage(m.id, currentUserId),
  }))
}

export function toggleStubReaction(
  _channelId: number,
  messageId: number,
  userId: number,
  emojiRaw: string
): { action: 'added' | 'removed'; reactions: Array<{ emoji: string; count: number; mine: boolean }> } {
  const emoji = isAllowedClairiereReactionEmoji(emojiRaw) ? emojiRaw.trim() : null
  if (!emoji) throw new Error('Emoji non autorisé')
  if (!reactionsByMessage.has(messageId)) reactionsByMessage.set(messageId, new Map())
  const byEmoji = reactionsByMessage.get(messageId)!
  if (!byEmoji.has(emoji)) byEmoji.set(emoji, new Set())
  const users = byEmoji.get(emoji)!
  let action: 'added' | 'removed'
  if (users.has(userId)) {
    users.delete(userId)
    if (users.size === 0) byEmoji.delete(emoji)
    action = 'removed'
  } else {
    users.add(userId)
    action = 'added'
  }
  return { action, reactions: reactionsForMessage(messageId, userId) }
}

export function recordStubChannelViewing(channelId: number, userId: number): void {
  if (!userId || !channelId) return
  viewingByUser.set(userId, { channelId, at: Date.now() })
}

export function clearStubChannelViewing(channelId: number, userId: number): void {
  if (!userId) return
  const cur = viewingByUser.get(userId)
  if (cur && cur.channelId === channelId) viewingByUser.delete(userId)
}

export function isStubUserViewingChannel(channelId: number, userId: number): boolean {
  const cur = viewingByUser.get(userId)
  if (!cur || cur.channelId !== channelId) return false
  return (Date.now() - cur.at) / 1000 <= STUB_VIEWING_SECONDS
}
