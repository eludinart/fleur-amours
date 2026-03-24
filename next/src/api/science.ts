import { api } from '@/lib/api-client'

export const scienceApi = {
  files: () => api.get('/api/science/files'),
  view: (filename: string) =>
    api.get(`/api/science/view/${encodeURIComponent(filename)}`),
}
