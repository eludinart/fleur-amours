import { api } from '@/lib/api-client'

export const statsApi = {
  overview: () => api.get('/api/stats/overview'),
  averages: (since?: string) =>
    api.get(`/api/stats/averages${since ? `?since=${since}` : ''}`),
  results: (params: Record<string, string | number | boolean> = {}) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return api.get(`/api/stats/results${q ? '?' + q : ''}`)
  },
  detail: (id: string) => api.get(`/api/stats/result/${id}`),
  delete: (id: string) => api.delete(`/api/stats/result/${id}`),
}
