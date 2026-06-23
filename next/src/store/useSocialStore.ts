'use client'

import { create } from 'zustand'
import { socialApi } from '@/api/social'

export type ChannelMessage = {
  id?: number
  messageId?: number
  senderId?: number
  body?: string
  cardSlug?: string
  temperature?: string
  createdAt?: string
  reactions?: Array<{ emoji: string; count: number; mine: boolean }>
}

export interface LisiereData {
  userId: string
  pseudo?: string
  avatarEmoji?: string
  bio?: string | null
  age?: number | null
  jardinIntention?: string | null
  scores?: Record<string, number>
  dominantPetal?: string
  dominantPetalName?: string
  topPetals?: Array<{ id: string; name: string; value: number; color: string }>
  echoInflorescence?: string
  resonanceWithVisitor?: number
  fleurMoyenne?: { petals: number[]; lastUpdated?: string }
  relationStatusWithVisitor?: 'none' | 'pending_out' | 'pending_in' | 'accepted'
  hasDuoLink?: boolean
  presence?: { is_online: boolean; last_seen_at: string | null }
  lastActivityAt?: string | null
  social?: Record<string, number>
  recentArrosages?: Array<{
    from_user_id: number
    from_pseudo: string
    avatar_emoji: string
    created_at: string
  }>
  incomingSeedId?: number | null
}

export interface SocialStoreState {
  lisiere: LisiereData | null
  lisiereLoading: boolean
  lisiereError: string | null
  relations: Record<string, string>
  pendingSeeds: Record<string, { seedId: number; targetUserId: number | string }>
  channels: Record<string, { channelId: number; otherUserId?: number; otherPseudo?: string }>
  messagesByChannel: Record<string, ChannelMessage[]>
  temperatureByChannel: Record<string, string>
  setLisiere: (data: LisiereData | null) => void
  clearLisiere: () => void
  loadLisiere: (viewedUserId: string | number) => Promise<LisiereData>
  sendSeed: (targetUserId: string | number, intentionId: string | number) => Promise<{ seedId: number }>
  acceptConnection: (seedId: number) => Promise<{ channelId: number }>
  loadChannelMessages: (channelId: number | string) => Promise<unknown[]>
  sendMessage: (channelId: number | string, payload: { body?: string; cardSlug?: string }) => Promise<unknown>
  setTemperature: (channelId: number | string, value: string) => void
  clairiereUnreadCount: number
  fetchClairiereUnread: () => Promise<number>
  markChannelRead: (channelId: number | string, opts?: { viewing?: boolean }) => Promise<void>
  toggleMessageReaction: (
    channelId: number | string,
    messageId: number,
    emoji: string
  ) => Promise<Array<{ emoji: string; count: number; mine: boolean }>>
}

/**
 * Store Zustand pour La Lisière, Le Germe et la Clairière.
 * Ne contient que des données publiques ou de relation ; pas de chroniques ni sessions privées.
 */
export const useSocialStore = create<SocialStoreState>((set, get) => ({
  lisiere: null,
  lisiereLoading: false,
  lisiereError: null,

  relations: {}, // { [targetUserId]: 'none' | 'pending_out' | 'pending_in' | 'accepted' | 'blocked' }
  pendingSeeds: {}, // { [targetUserId]: { seedId, targetUserId } } (graines que j'ai envoyées)
  channels: {}, // { [channelId]: { channelId, otherUserId, otherPseudo } }
  messagesByChannel: {}, // { [channelId]: Array<{ id, senderId, body, cardSlug, temperature, createdAt }> }
  temperatureByChannel: {}, // { [channelId]: 'calm' | 'vibrant' | 'tense' | 'breach' }

  setLisiere: (data) => set({ lisiere: data, lisiereError: null }),
  clearLisiere: () => set({ lisiere: null, lisiereError: null }),

  loadLisiere: async (viewedUserId) => {
    set({ lisiereLoading: true, lisiereError: null })
    try {
      const data = (await socialApi.visitLisiere(String(viewedUserId))) as LisiereData
      set({
        lisiere: data,
        lisiereLoading: false,
        lisiereError: null,
        relations: { ...get().relations, [String(data.userId)]: data.relationStatusWithVisitor || 'none' },
      })
      return data
    } catch (err) {
      set({
        lisiere: null,
        lisiereLoading: false,
        lisiereError: (err as { detail?: string; message?: string })?.detail || (err as { message?: string })?.message || 'Erreur',
      })
      throw err
    }
  },

  sendSeed: async (targetUserId, intentionId) => {
    const result = (await socialApi.sendSeed(
      String(targetUserId),
      String(intentionId)
    )) as { seedId: number; firstFree?: boolean }
    set((s) => ({
      pendingSeeds: { ...s.pendingSeeds, [String(targetUserId)]: { seedId: result.seedId, targetUserId } },
      relations: { ...s.relations, [String(targetUserId)]: 'pending_out' },
    }))
    return result
  },

  acceptConnection: async (seedId) => {
    const result = (await socialApi.acceptConnection(String(seedId))) as { channelId: number }
    set((s) => ({
      relations: { ...s.relations },
      channels: { ...s.channels, [String(result.channelId)]: { channelId: result.channelId } },
    }))
    return result
  },

  loadChannelMessages: async (channelId) => {
    const data = (await socialApi.getChannelMessages(String(channelId))) as { messages?: ChannelMessage[] }
    const serverMessages = data.messages || []
    set((s) => {
      const key = String(channelId)
      const current = s.messagesByChannel[key] || []
      const serverIds = new Set(serverMessages.map((m) => String(m.id ?? m.messageId)))
      const now = Date.now()
      const recentThreshold = now - 10000
      const localOnly = current.filter((m) => {
        const id = String(m.id ?? m.messageId ?? '')
        if (serverIds.has(id)) return false
        const msgTime = new Date(m.createdAt || 0).getTime()
        if (msgTime <= recentThreshold) return false
        const superseded = serverMessages.some(
          (sm) =>
            sm.senderId === m.senderId &&
            (sm.body || '') === (m.body || '') &&
            (sm.cardSlug || '') === (m.cardSlug || '') &&
            Math.abs(new Date(sm.createdAt || 0).getTime() - msgTime) < 3000
        )
        return !superseded
      })
      const merged: ChannelMessage[] = [...serverMessages, ...localOnly].sort(
        (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      )
      return {
        messagesByChannel: { ...s.messagesByChannel, [key]: merged },
      }
    })
    return data.messages || []
  },

  sendMessage: async (channelId, payload) => {
    const msg = (await socialApi.sendMessage(String(channelId), payload)) as ChannelMessage & { temperature?: string }
    set((s) => {
      const list = s.messagesByChannel[String(channelId)] || []
      return {
        messagesByChannel: {
          ...s.messagesByChannel,
          [String(channelId)]: [...list, msg],
        },
        temperatureByChannel: {
          ...s.temperatureByChannel,
          [String(channelId)]: msg.temperature || 'calm',
        },
      }
    })
    return msg
  },

  setTemperature: (channelId, value) =>
    set((s) => ({
      temperatureByChannel: { ...s.temperatureByChannel, [String(channelId)]: value },
    })),

  clairiereUnreadCount: 0,
  fetchClairiereUnread: async () => {
    try {
      const data = await socialApi.clairiereUnreadCount()
      set({ clairiereUnreadCount: data.count ?? 0 })
      return data.count ?? 0
    } catch {
      set({ clairiereUnreadCount: 0 })
      return 0
    }
  },
  markChannelRead: async (channelId, opts) => {
    try {
      await socialApi.markChannelRead(Number(channelId), opts)
      if (opts?.viewing !== false) get().fetchClairiereUnread()
    } catch {
      /* silent */
    }
  },

  toggleMessageReaction: async (channelId, messageId, emoji) => {
    const result = await socialApi.toggleMessageReaction(Number(channelId), messageId, emoji)
    const reactions = result.reactions ?? []
    set((s) => {
      const key = String(channelId)
      const list = s.messagesByChannel[key] || []
      return {
        messagesByChannel: {
          ...s.messagesByChannel,
          [key]: list.map((m) => {
            const mid = Number(m.id ?? m.messageId)
            if (mid !== messageId) return m
            return { ...m, reactions }
          }),
        },
      }
    })
    return reactions
  },
}))
