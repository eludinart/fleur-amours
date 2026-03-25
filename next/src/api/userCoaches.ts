import { api } from '@/lib/api-client'

export const userCoachesApi = {
  myCoaches: () => api.get('/api/user/my_coaches').then((r) => r as Promise<{ coaches: any[] }>),
}

