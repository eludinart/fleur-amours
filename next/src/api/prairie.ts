import { api } from '@/lib/api-client'

export const prairieApi = {
  getFleurs: () => api.get('/api/prairie/fleurs'),
  checkVisibility: () => api.get('/api/prairie/check-visibility'),
  arroser: (toUserId: string) => api.post('/api/prairie/arroser', { to_user_id: toUserId }),
  pollen: (toUserId: string, cardSlug: string) =>
    api.post('/api/prairie/pollen', { to_user_id: toUserId, card_slug: cardSlug }),
  addLink: (toUserId: string) => api.post('/api/prairie/add-link', { to_user_id: toUserId }),
  removeLink: (toUserId: string) => api.post('/api/prairie/remove-link', { to_user_id: toUserId }),
  forceVisible: (email: string) => api.post('/api/admin/prairie/force-visible', { email }),
}
