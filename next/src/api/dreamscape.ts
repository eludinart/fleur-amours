import { api } from '@/lib/api-client'

export const dreamscapeApi = {
  save: (data: Record<string, unknown>) => api.post('/api/dreamscape/save', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.post('/api/dreamscape/update', { ...data, id }),
  my: () => api.get('/api/dreamscape/my'),
  share: (id: string) => api.post('/api/dreamscape/share', { id }),
  getShared: (token: string) =>
    api.get(`/api/dreamscape/shared?token=${encodeURIComponent(token)}`),
}
