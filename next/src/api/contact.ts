import { api } from '@/lib/api-client'

// ⚠ STUB : aucun handler Next.js dédié — toutes ces routes tombent sur le catch-all.
// Implémenter next/src/app/api/contact_messages/**/route.ts pour une persistance réelle.
const warnStub = (fn: string) =>
  console.warn(`[contact] ${fn} : route stub (pas de backend réel)`)

export const contactApi = {
  submit: (data: Record<string, unknown>) => {
    warnStub('submit'); return api.post('/api/contact_messages/save', data)
  },
  stats: () => { warnStub('stats'); return api.get('/api/contact_messages/stats') },
  list: (params: Record<string, unknown> = {}) => {
    warnStub('list')
    const clean = Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null && v !== ''
      )
    )
    const q = new URLSearchParams(clean as Record<string, string>).toString()
    return api.get(`/api/contact_messages/list${q ? '?' + q : ''}`)
  },
  get: (id: string) => { warnStub('get'); return api.get(`/api/contact_messages/get?id=${id}`) },
  update: (data: Record<string, unknown>) => {
    warnStub('update'); return api.post('/api/contact_messages/update', data)
  },
}
