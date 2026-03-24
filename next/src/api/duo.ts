import { api } from '@/lib/api-client'

export const duoApi = {
  status: () => api.get('/api/duo/status'),
  submitSolo: (payload: Record<string, unknown>) =>
    api.post('/api/duo/solo', payload),
  getResult: (token: string) => api.get(`/api/duo/result/${token}`),
  invitePartner: (payload: Record<string, unknown>) =>
    api.post('/api/duo/invite', payload),
  submitPartner: (payload: Record<string, unknown>) =>
    api.post('/api/duo/submit-partner', payload),
  getDuoResult: (token: string) =>
    api.get(`/api/duo/duo-result/${token}`),
}
