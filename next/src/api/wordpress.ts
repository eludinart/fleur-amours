import { api } from '@/lib/api-client'

// ⚠ STUB : aucun handler Next.js dédié — toutes ces routes tombent sur le catch-all.
// Il n'y a pas d'intégration WordPress active dans ce projet Node-only.
const warnStub = (fn: string) =>
  console.warn(`[wordpress] ${fn} : route stub — intégration WP non implémentée`)

export const wpApi = {
  status: () => { warnStub('status'); return api.get('/api/wp/status') },
  posts: (params: Record<string, string> = {}) => {
    warnStub('posts')
    const q = new URLSearchParams(params).toString()
    return api.get(`/api/wp/posts${q ? '?' + q : ''}`)
  },
  post: (id: string) => { warnStub('post'); return api.get(`/api/wp/posts/${id}`) },
  pages: () => { warnStub('pages'); return api.get('/api/wp/pages') },
  cpt: (type: string, params: Record<string, string> = {}) => {
    warnStub('cpt')
    const q = new URLSearchParams(params).toString()
    return api.get(`/api/wp/${type}${q ? '?' + q : ''}`)
  },
}
