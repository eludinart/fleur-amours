import { api } from '@/lib/api-client'

export type DyadDTO = {
  id: number
  userA: number
  userB: number | null
  inviteeEmail: string | null
  status: 'pending' | 'active' | 'ended'
  label: string | null
  fleur: Record<string, number> | null
  fleurUpdatedAt: string | null
  createdAt: string
}

export type DyadEventDTO = {
  id: number
  dyadId: number
  authorId: number | null
  type: string
  content: string | null
  createdAt: string
}

export type DyadRitualDTO = {
  id: number
  dyadId: number
  kind: string
  title: string
  cadenceDays: number
  active: boolean
  lastDoneAt: string | null
  nextDueAt: string | null
}

export type DyadOperationalSummaryDTO = {
  headline: string
  climate: string
  alignments: string
  gaps: string
  nextStep: string
}

export type DyadSummaryRecordDTO = {
  id: number
  signature: string
  summary: DyadOperationalSummaryDTO
  provider: string | null
  createdAt: string
}

export type MediationDTO = {
  reframed: string
  otherPerspective: string
  deescalation: string
  suggestion: string
}

export type DyadMemberProfileDTO = {
  userId: number
  label: string
  petals: Record<string, number> | null
}

export type DyadMembersDTO = {
  memberA: DyadMemberProfileDTO
  memberB: DyadMemberProfileDTO | null
}

export type IncomingDyadInviteDTO = {
  dyadId: number
  token: string
  fromUserId: number
  inviteeEmail: string | null
  inviteUrl: string
}

export const dyadsApi = {
  me: () =>
    api.get('/api/dyads') as Promise<{
      dyad: DyadDTO | null
      events?: DyadEventDTO[]
      rituals?: DyadRitualDTO[]
      role?: 'a' | 'b'
      inviteUrl?: string | null
      incomingInvite?: IncomingDyadInviteDTO | null
      members?: DyadMembersDTO | null
    }>,
  invite: (email: string, label?: string) =>
    api.post('/api/dyads/invite', { email, label }) as Promise<{ dyad: DyadDTO; token: string; inviteUrl: string }>,
  accept: (token: string) => api.post('/api/dyads/accept', { token }) as Promise<{ dyad: DyadDTO }>,
  postEvent: (content: string) => api.post('/api/dyads/events', { content }) as Promise<{ id: number; saved: boolean }>,
  computeFleur: (petalsA?: Record<string, number>, petalsB?: Record<string, number>) =>
    api.post('/api/dyads/fleur', { petalsA, petalsB }) as Promise<{ fleur: Record<string, number>; fleurUpdatedAt: string }>,
  rituals: () => api.get('/api/dyads/rituals') as Promise<{ rituals: DyadRitualDTO[] }>,
  createRitual: (data: { title: string; kind?: string; cadenceDays?: number }) =>
    api.post('/api/dyads/rituals', data) as Promise<{ id: number; created: boolean }>,
  completeRitual: (ritualId: number) =>
    api.post('/api/dyads/rituals', { action: 'complete', ritualId }) as Promise<{ completed: boolean }>,
  mediation: (message: string, locale: string) =>
    api.post('/api/ai/relational-mediation', { message, locale }) as Promise<{ mediation: MediationDTO }>,
  getOperationalSummary: (locale: string) =>
    api.get(`/api/dyads/operational-summary?locale=${encodeURIComponent(locale)}`) as Promise<{
      latest: DyadSummaryRecordDTO | null
      history: DyadSummaryRecordDTO[]
      currentSignature: string | null
      matchesCurrentState: boolean
    }>,
  generateOperationalSummary: (locale: string, force = false) =>
    api.post('/api/dyads/operational-summary', { locale, force }) as Promise<{
      summary: DyadOperationalSummaryDTO
      record: DyadSummaryRecordDTO | null
      cached: boolean
      history: DyadSummaryRecordDTO[]
    }>,
}
