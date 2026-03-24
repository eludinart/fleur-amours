import { api } from '@/lib/api-client'

export const contactApi = {
  submit: (data: Record<string, unknown>) =>
    api.post('/api/contact_messages/save', data),
  stats: () => api.get('/api/contact_messages/stats'),
  list: (params: Record<string, unknown> = {}) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null && v !== ''
      )
    )
    const q = new URLSearchParams(clean as Record<string, string>).toString()
    return api.get(`/api/contact_messages/list${q ? '?' + q : ''}`)
  },
  get: (id: string) => api.get(`/api/contact_messages/get?id=${id}`),
  update: (data: Record<string, unknown>) =>
    api.post('/api/contact_messages/update', data),
}
