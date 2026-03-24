import { api } from '@/lib/api-client'

export const sessionsApi = {
  save: (data: Record<string, unknown>) => api.post('/api/sessions/save', data),
  update: (data: Record<string, unknown>) => api.post('/api/sessions/update', data),
  my: (status?: string) => {
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    const qs = p.toString()
    return api.get(`/api/sessions/my${qs ? '?' + qs : ''}`)
  },
  list: ({
    page = 1,
    per_page = 15,
    search,
    dateFrom,
    dateTo,
    status,
    shadowOnly,
  }: {
    page?: number
    per_page?: number
    search?: string
    dateFrom?: string
    dateTo?: string
    status?: string
    shadowOnly?: boolean
  } = {}) => {
    const p = new URLSearchParams({ page: String(page), per_page: String(per_page) })
    if (search) p.set('search', search)
    if (dateFrom) p.set('date_from', dateFrom)
    if (dateTo) p.set('date_to', dateTo)
    if (status) p.set('status', status)
    if (shadowOnly) p.set('shadow', '1')
    return api.get(`/api/sessions/list?${p}`)
  },
  get: (id: string) => api.get(`/api/sessions/${id}`),
  stats: () => api.get('/api/sessions/stats'),
  shadowStats: () => api.get('/api/sessions/shadow-stats'),
  delete: (id: string) => api.delete(`/api/sessions/${id}`),
  analyticsOverview: () => api.get('/api/analytics/overview'),
  suivi: ({ search, shadow, sort }: { search?: string; shadow?: boolean; sort?: string } = {}) => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (shadow) p.set('shadow', '1')
    if (sort) p.set('sort', sort)
    return api.get(`/api/users/suivi?${p}`)
  },
  suiviDetail: (email: string) =>
    api.get(`/api/users/suivi/detail?email=${encodeURIComponent(email)}`),
}
