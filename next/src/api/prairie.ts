import { api } from '@/lib/api-client'

export type JardinPouls = {
  arrosagesToday: number
  pollensToday: number
  jardiniersOnline: number
  jardiniersPublicTotal: number
  fleursWeek: number
  dominantPetalToday: string | null
  recentEclosions: Array<{
    userId: number
    pseudo: string
    avatarEmoji: string
    createdAt: string
  }>
  semisToday: number
}

export const prairieApi = {
  getFleurs: () => api.get('/api/prairie/fleurs'),
  getPouls: () => api.get('/api/prairie/pouls') as Promise<JardinPouls>,
  checkVisibility: () => api.get('/api/prairie/check-visibility'),
  arroser: (toUserId: string) => api.post('/api/prairie/arroser', { to_user_id: toUserId }),
  pollen: (toUserId: string, cardSlug: string) =>
    api.post('/api/prairie/pollen', { to_user_id: toUserId, card_slug: cardSlug }),
  addLink: (toUserId: string) => api.post('/api/prairie/add-link', { to_user_id: toUserId }),
  removeLink: (toUserId: string) => api.post('/api/prairie/remove-link', { to_user_id: toUserId }),
  forceVisible: (email: string) => api.post('/api/admin/prairie/force-visible', { email }),
}
