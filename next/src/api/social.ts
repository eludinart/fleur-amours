import { api } from '@/lib/api-client'

export const socialApi = {
  visitLisiere: (userId: string) =>
    api.get(`/api/social/visit_lisiere?user_id=${encodeURIComponent(userId)}`),
  sendSeed: (targetUserId: string, intentionId: string) =>
    api.post('/api/social/send_seed', { targetUserId, intentionId }),
  acceptConnection: (seedId: string) =>
    api.post('/api/social/accept_connection', { seedId }),
  rejectConnection: (seedId: string) =>
    api.post('/api/social/reject_connection', { seedId }),
  pendingSeedsIncoming: (params: { intention_ids?: string; limit?: number } = {}) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    )
    const q = new URLSearchParams(clean as Record<string, string>).toString()
    return api.get(`/api/social/pending_seeds_incoming${q ? '?' + q : ''}`)
  },
  getMyChannels: () => api.get('/api/social/my_channels'),
  getChannelMessages: (channelId: string) =>
    api.get(`/api/social/channel_messages?channel_id=${encodeURIComponent(channelId)}`),
  sendMessage: (channelId: string, payload: Record<string, unknown>) =>
    api.post('/api/social/send_message', { channelId, ...payload }),
  presenceHeartbeat: () => api.get('/api/social/presence_heartbeat'),
  clairiereUnreadCount: () =>
    api.get('/api/social/clairiere_unread_count') as Promise<{ count: number }>,
  markChannelRead: (channelId: number) =>
    api.post('/api/social/mark_channel_read', { channelId }),
}

export const INTENTIONS = [
  { id: 'resonance', label: 'Partager une résonance' },
  { id: 'eclairage', label: "Demander un éclairage" },
  { id: 'ludus', label: 'Exploration Ludus' },
  { id: 'philia', label: "Créer un lien d'amitié" },
  { id: 'agape', label: 'Offrir une présence bienveillante' },
]
