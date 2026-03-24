import { api } from '@/lib/api-client'

export const tarotReadingsApi = {
  save: (data: Record<string, unknown>) => api.post('/api/tarot_readings/save', data),
  interpret: (data: Record<string, unknown>) =>
    api.post('/api/ai/tarot-interpretation', data),
  stats: () => api.get('/api/tarot_readings/stats'),
  my: () => api.get('/api/tarot_readings/my'),
  list: (params: Record<string, unknown> = {}) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null && v !== ''
      )
    )
    const q = new URLSearchParams(clean as Record<string, string>).toString()
    return api.get(`/api/tarot_readings/list${q ? '?' + q : ''}`)
  },
  get: (id: string) => api.get(`/api/tarot_readings/get?id=${id}`),
  update: (id: string, payload: Record<string, unknown>) =>
    api.post('/api/tarot_readings/update', { id, payload }),
  delete: (id: string) => api.post('/api/tarot_readings/delete', { id }),
}
