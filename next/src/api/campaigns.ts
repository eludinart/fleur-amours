import { api } from '@/lib/api-client'

export const campaignsApi = {
  list: (params: Record<string, string | number> = {}) => {
    const strParams = Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    )
    const q = new URLSearchParams(strParams).toString()
    return api.get(`/api/campaigns${q ? '?' + q : ''}`)
  },
  get: (id: string) => api.get(`/api/campaigns/${id}`),
  create: (payload: Record<string, unknown>) =>
    api.post('/api/campaigns', payload),
  results: (id: string) => api.get(`/api/campaigns/${id}/results`),
  submitAnswers: (payload: Record<string, unknown>) =>
    api.post('/api/campaigns/answer', payload),
  definitions: () => api.get('/api/campaigns/definitions'),
  createDef: (payload: Record<string, unknown>) =>
    api.post('/api/campaigns/definitions', payload),
}
