import { api } from '@/lib/api-client'

export const graphApi = {
  get: (minShared = 1) => api.get(`/api/graph?min_shared=${minShared}`),
  simulate: (seeds: unknown[], steps = 6, decay = 0.6) =>
    api.post('/api/simulate', { seeds, steps, decay }),
}
