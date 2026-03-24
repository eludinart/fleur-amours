import { api } from '@/lib/api-client'

export const wpApi = {
  status: () => api.get('/api/wp/status'),
  posts: (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/api/wp/posts${q ? '?' + q : ''}`)
  },
  post: (id: string) => api.get(`/api/wp/posts/${id}`),
  pages: () => api.get('/api/wp/pages'),
  cpt: (type: string, params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString()
    return api.get(`/api/wp/${type}${q ? '?' + q : ''}`)
  },
}
