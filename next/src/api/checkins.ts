import { api } from '@/lib/api-client'

export type CheckinDTO = {
  id: number
  userId: number
  mood: number
  tension: number
  note: string | null
  createdAt: string
}

export const checkinsApi = {
  my: () => api.get('/api/checkins') as Promise<{ checkins: CheckinDTO[] }>,
  save: (data: { mood: number; tension: number; note?: string }) =>
    api.post('/api/checkins', data) as Promise<{ id: number; mood: number; tension: number; saved: boolean }>,
}
