import { api } from '@/lib/api-client'

export const dreamscapeApi = {
  save: (data: Record<string, unknown>) => api.post('/api/dreamscape/save', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.post('/api/dreamscape/update', { ...data, id }),
  /** Met à jour uniquement snapshot_base64 (régénération aperçu). */
  updateSnapshot: (id: string, snapshot: string | null) =>
    api.post('/api/dreamscape/snapshot', { id, snapshot }),
  my: () => api.get('/api/dreamscape/my'),
  share: (id: string) => api.post('/api/dreamscape/share', { id }),
  getShared: (token: string) =>
    api.get(`/api/dreamscape/shared?token=${encodeURIComponent(token)}`),
}
