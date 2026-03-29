import { api } from '@/lib/api-client'

// ⚠ STUB : aucun handler Next.js dédié — toutes ces routes tombent sur le catch-all.
// Implémenter next/src/app/api/campaigns/**/route.ts pour une persistance réelle.
const warnStub = (fn: string) =>
  console.warn(`[campaigns] ${fn} : route stub (pas de backend réel)`)

export const campaignsApi = {
  list: (params: Record<string, string | number> = {}) => {
    warnStub('list')
    const strParams = Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    )
    const q = new URLSearchParams(strParams).toString()
    return api.get(`/api/campaigns${q ? '?' + q : ''}`)
  },
  get: (id: string) => { warnStub('get'); return api.get(`/api/campaigns/${id}`) },
  create: (payload: Record<string, unknown>) => {
    warnStub('create'); return api.post('/api/campaigns', payload)
  },
  results: (id: string) => { warnStub('results'); return api.get(`/api/campaigns/${id}/results`) },
  submitAnswers: (payload: Record<string, unknown>) => {
    warnStub('submitAnswers'); return api.post('/api/campaigns/answer', payload)
  },
  definitions: () => { warnStub('definitions'); return api.get('/api/campaigns/definitions') },
  createDef: (payload: Record<string, unknown>) => {
    warnStub('createDef'); return api.post('/api/campaigns/definitions', payload)
  },
}
