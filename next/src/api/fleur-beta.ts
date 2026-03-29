import { api } from '@/lib/api-client'

export const fleurBetaApi = {
  getQuestions: (porte: string) => api.get(`/api/fleur-beta/questions?porte=${encodeURIComponent(porte)}`),
  submit: (payload: Record<string, unknown>) => api.post('/api/fleur-beta/submit', payload),
  getResult: (resultId: string) => api.get(`/api/fleur-beta/result/${resultId}`),
  delete: (id: number) => api.post('/api/fleur-beta/delete', { id }),
  interpretation: (params: { result_id: number; locale?: string; force?: boolean }) =>
    api.post('/api/fleur-beta/interpretation', params),
}
