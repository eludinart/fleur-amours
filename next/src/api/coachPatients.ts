import { api } from '@/lib/api-client'

export const coachPatientsApi = {
  listMyPatients: () => api.get('/api/coach/patients').then((r) => r as Promise<{ patients: any[] }>),
  invite: (payload: { email: string; intention_id: string }) =>
    api.post('/api/coach/patients/invite', payload).then((r) => r as any),
  acceptInvite: (invite_token: string) =>
    api.post('/api/coach/patients/accept-invite', { invite_token }).then((r) => r as any),
  rebuildScience: (payload: { patient_user_id: number; locale?: string }) =>
    api.post('/api/coach/patients/rebuild', payload).then((r) => r as any),
}

