import { api } from '@/lib/api-client'

export type TimelineEventDTO = {
  id: number
  userId: number
  source:
    | 'session'
    | 'tirage'
    | 'paper_draw'
    | 'fleur'
    | 'checkin'
    | 'dyad'
    | 'ritual'
    | 'onboarding'
    | 'dreamscape'
    | 'diagnostic'
  refId: number | null
  title: string
  summary: string | null
  petals: number[] | null
  mood: number | null
  createdAt: string
}

export type TimelineNarrative = {
  headline: string
  movement: string
  focus: string
  encouragement: string
}

export const timelineApi = {
  my: (limit = 60) => api.get(`/api/timeline/my?limit=${limit}`) as Promise<{ events: TimelineEventDTO[] }>,
  narrative: (locale: string) =>
    api.post('/api/ai/timeline-narrative', { locale }) as Promise<{ narrative: TimelineNarrative; cached: boolean }>,
}
