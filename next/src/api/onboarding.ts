import { api } from '@/lib/api-client'

export type BaselineDTO = {
  petals: Record<string, number>
  intention: string | null
  createdAt: string
} | null

export const onboardingApi = {
  getBaseline: () => api.get('/api/onboarding/baseline') as Promise<{ baseline: BaselineDTO }>,
  saveBaseline: (data: { petals: Record<string, number>; intention?: string }) =>
    api.post('/api/onboarding/baseline', data) as Promise<{ created: boolean; baseline: BaselineDTO }>,
}
