import { api } from '@/lib/api-client'

export type LienItem = {
  userId: number
  pseudo: string
  avatarEmoji: string
  isOnline: boolean
  lastSeenAt: string | null
  channelId: number | null
  unreadCount: number
  relation: 'pending_in' | 'pending_out' | 'accepted' | 'arrosage_recent' | 'pollen_recent'
  lastSignalAt: string | null
  signalKind: 'message' | 'rosee' | 'pollen' | 'seed' | 'link'
  seedId: number | null
  intentionId: string | null
  maturityBadges?: string[]
}

export const socialApi = {
  visitLisiere: (userId: string) =>
    api.get(`/api/social/visit_lisiere?user_id=${encodeURIComponent(userId)}`),
  sendSeed: (targetUserId: string, intentionId: string) =>
    api.post('/api/social/send_seed', { targetUserId, intentionId }),
  acceptConnection: (seedId: string) =>
    api.post('/api/social/accept_connection', { seedId }),
  rejectConnection: (seedId: string) =>
    api.post('/api/social/reject_connection', { seedId }),
  snoozeSeed: (seedId: string | number) =>
    api.post('/api/social/snooze_seed', { seedId: Number(seedId) }),
  pendingSeedsIncoming: (params: { intention_ids?: string; limit?: number } = {}) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    )
    const q = new URLSearchParams(clean as Record<string, string>).toString()
    return api.get(`/api/social/pending_seeds_incoming${q ? '?' + q : ''}`)
  },
  getMyChannels: () => api.get('/api/social/my_channels'),
  getMyLiens: () => api.get('/api/social/my_liens') as Promise<{ liens: LienItem[] }>,
  getChannelMessages: (channelId: string) =>
    api.get(`/api/social/channel_messages?channel_id=${encodeURIComponent(channelId)}`),
  sendMessage: (channelId: string, payload: Record<string, unknown>) =>
    api.post('/api/social/send_message', { channelId, ...payload }),
  presenceHeartbeat: () =>
    api.get('/api/social/presence_heartbeat') as Promise<{
      ok: boolean
      meteoPetal?: string | null
      socialMode?: 'open' | 'focus'
    }>,
  getMeteo: () =>
    api.get('/api/social/meteo') as Promise<{
      meteoPetal: string | null
      socialMode: 'open' | 'focus'
    }>,
  setMeteo: (payload: { meteoPetal?: string | null; socialMode?: 'open' | 'focus' }) =>
    api.post('/api/social/meteo', payload) as Promise<{
      meteoPetal: string | null
      socialMode: 'open' | 'focus'
    }>,
  clairiereUnreadCount: () =>
    api.get('/api/social/clairiere_unread_count') as Promise<{ count: number }>,
  markChannelRead: (channelId: number) =>
    api.post('/api/social/mark_channel_read', { channelId }),
  markCommunityOnboardingDone: () =>
    api.post('/api/social/community_onboarding_done', {}),
  muteUser: (targetUserId: string | number, mute = true) =>
    api.post('/api/social/mute', { target_user_id: Number(targetUserId), mute }) as Promise<{
      status: string
      muted: boolean
    }>,
  reportUser: (targetUserId: string | number, reason: string, detail?: string) =>
    api.post('/api/social/report', { target_user_id: Number(targetUserId), reason, detail }) as Promise<{
      status: string
      reportId: number
      muted: boolean
    }>,
  getSemis: (petalId?: string) =>
    api.get(`/api/social/semis${petalId ? `?petal_id=${encodeURIComponent(petalId)}` : ''}`) as Promise<{
      items: Array<{ id: number; petalId: string; body: string; createdAt: string }>
      status: { canPostToday: boolean; todaySemis: { id: number; petalId: string; body: string; createdAt: string } | null }
    }>,
  postSemis: (petalId: string, body: string) =>
    api.post('/api/social/semis', { petalId, body }),
  listConstellations: () =>
    api.get('/api/social/constellations') as Promise<{ items: Array<Record<string, unknown>> }>,
  createConstellation: (payload: { title?: string; petalId?: string | null }) =>
    api.post('/api/social/constellation/create', payload),
  joinConstellation: (token: string) =>
    api.post('/api/social/constellation/join', { token }),
  getConstellation: (token: string) =>
    api.get(`/api/social/constellation/${encodeURIComponent(token)}`),
  postConstellationMessage: (token: string, body: string) =>
    api.post(`/api/social/constellation/${encodeURIComponent(token)}/message`, { body }),
  listSalons: () => api.get('/api/social/salons'),
  getSalon: (petal: string) => api.get(`/api/social/salons/${encodeURIComponent(petal)}`),
  postSalonMessage: (petal: string, body: string) =>
    api.post(`/api/social/salons/${encodeURIComponent(petal)}`, { body }),
}

export const INTENTIONS = [
  { id: 'resonance', label: 'Partager une résonance' },
  { id: 'eclairage', label: "Demander un éclairage" },
  { id: 'ludus', label: 'Exploration Ludus' },
  { id: 'philia', label: "Créer un lien d'amitié" },
  { id: 'agape', label: 'Offrir une présence bienveillante' },
]
