/**
 * Stockage en mémoire pour les messages du chat P2P en mode stub (sans DB).
 */
export type StubMessage = {
  id: number
  senderId: number
  body: string | null
  cardSlug: string | null
  temperature: string
  createdAt: string
}

const messagesByChannel = new Map<number, StubMessage[]>()

export function addStubMessage(channelId: number, msg: StubMessage): void {
  const list = messagesByChannel.get(channelId) || []
  messagesByChannel.set(channelId, [...list, msg])
}

export function getStubMessages(channelId: number): StubMessage[] {
  return messagesByChannel.get(channelId) || []
}
