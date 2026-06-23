import { api } from '@/lib/api-client'

export type LandingReadingDTO = {
  mirror: string
  reading: string
  question: string
  cached?: boolean
  fallback?: boolean
}

export const landingReadingApi = {
  generate: (data: {
    cardName: string
    essence?: string
    lumiere?: string
    rootQuestion?: string
    intention?: string
    locale?: string
  }) => api.post('/api/ai/landing-reading', data) as Promise<LandingReadingDTO>,
}
