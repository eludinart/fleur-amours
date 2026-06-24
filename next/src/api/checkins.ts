import { api } from '@/lib/api-client'

export type CheckinEchoDTO = {
  echo: string
  highlight_petal: string
  invitation: string
  whisper: string
  provider?: string
}

export type CheckinDTO = {
  id: number
  userId: number
  mood: number
  tension: number
  note: string | null
  intention: string | null
  highlightPetal: string | null
  aiResponse: CheckinEchoDTO | null
  feltAfter: number | null
  createdAt: string
}

export type CheckinSuggestionDTO = {
  kind: 'petal' | 'baseline' | 'followup' | 'reading' | 'session' | 'shadow' | 'jardin' | 'paper'
  petalId?: string
  text: string
}

export type CheckinContextDTO = {
  petals: Record<string, number>
  suggestions: CheckinSuggestionDTO[]
  lastEcho: {
    whisper: string | null
    highlightPetal: string | null
    echo: string | null
    invitation: string | null
    intention?: string | null
    createdAt: string
  } | null
  todayEcho: {
    whisper: string | null
    highlightPetal: string | null
    echo: string | null
    invitation: string | null
    intention?: string | null
    createdAt: string
  } | null
  checkedInToday: boolean
}

export const checkinsApi = {
  my: () =>
    api.get('/api/checkins') as Promise<{
      checkins: CheckinDTO[]
      context: CheckinContextDTO | null
    }>,
  save: (data: {
    intention?: string
    highlightPetal?: string
    aiResponse?: CheckinEchoDTO
    feltAfter?: number
    mood?: number
    tension?: number
    note?: string
  }) =>
    api.post('/api/checkins', data) as Promise<{ id: number; mood: number; tension: number; saved: boolean }>,
}
