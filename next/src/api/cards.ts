import { api } from '@/lib/api-client'

export const cardsApi = {
  list: () => api.get('/api/cards'),
  get: (id: string) => api.get(`/api/cards/${encodeURIComponent(id)}`),
  update: (slug: string, card: Record<string, unknown>) =>
    api.put(`/api/cards/${encodeURIComponent(slug)}`, card),
  import: (data: Record<string, unknown>) => api.post('/api/cards/import', data),
  files: () => api.get('/api/files'),
  invariants: () => api.get('/api/invariants'),
}
