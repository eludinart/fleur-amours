import { api } from '@/lib/api-client'

export type OrgDTO = {
  id: number
  name: string
  ownerUserId: number
  createdAt: string
  charter?: string | null
  pulseCampaign?: PulseCampaignDTO | null
}

export type PulseCampaignDTO = {
  title: string
  message: string
  question: string
  startedAt: string
  active: boolean
}
export type TeamDTO = { id: number; orgId: number; name: string; createdAt: string }
export type OrgInviteDTO = { id: number; email: string; role: string; teamId: number | null; status: string }

export type ClimateDTO = {
  available: boolean
  reason?: string
  respondents: number
  threshold: number
  petalsAverage: Record<string, number> | null
  moodAverage: number | null
  eventCount: number
  windowDays: number
}

export type WorkCheckinDTO = {
  id: number
  userId: number
  orgId: number
  teamId: number | null
  mood: number
  note: string | null
  createdAt: string
}

export type WorkProfileDTO = {
  userId: number
  orgId: number
  petals: Record<string, number>
  updatedAt: string
}

export type AdoptionStatsDTO = {
  totalMembers: number
  withProfile: number
  withCheckin30d: number
  checkinCount30d: number
  participationRate: number
}

export type DimensionAlertDTO = {
  petalId: string
  label: string
  direction: 'down' | 'up'
  delta: number
  hint: string
}

export type StatsDTO = {
  org: OrgDTO | null
  role: string | null
  teams: TeamDTO[]
  members: number
  adoption: AdoptionStatsDTO
  dashboard: {
    current: ClimateDTO
    previous: ClimateDTO
    moodDelta: number | null
    participationRate: number
    totalMembers: number
  }
  alerts: DimensionAlertDTO[]
  needsOrg?: boolean
}

export type MyceliumSynthesisDTO = {
  summary: string
  actions: string[]
  cached_at: string
  provider: string
}

export type MyceliumAccessDTO = {
  member: boolean
  canManage: boolean
  orgId: number | null
  orgName: string | null
  orgRole: string | null
  isAppAdmin: boolean
  showAdmin: boolean
  showDashboard: boolean
  showEspace: boolean
}

export type MyceliumInterviewTopicDTO = {
  slug: string
  labelKey: string
  introKey: string
  dimensions: string[]
}

export type MyceliumInterviewMessageDTO = {
  role: 'assistant' | 'user'
  content: string
  at: string
}

export type MyceliumInterviewDTO = {
  id: number
  topicSlug: string
  topicLabel: string
  status: string
  messages: MyceliumInterviewMessageDTO[]
  closure: {
    mood: number
    employeeSummary: string
    pulseNote: string
    dimensions: string[]
    provider: string
  } | null
  createdAt: string
  completedAt: string | null
}

export type InterviewAiTurnDTO = {
  acknowledgment: string
  question: string | null
  proposeClose: boolean
  closureMessage: string | null
  suggestedMood: number | null
  employeeSummary: string | null
  pulseNote: string | null
  dimensions: string[]
  turn: number
  maxTurns: number
  provider: string
}

export const myceliumApi = {
  getOrg: () =>
    api.get('/api/mycelium/org') as Promise<{
      org: OrgDTO | null
      role?: string
      teams?: TeamDTO[]
      members?: number
      seats?: number
      invites?: OrgInviteDTO[]
    }>,
  createOrg: (name: string) => api.post('/api/mycelium/org', { name }) as Promise<{ org: OrgDTO }>,
  createTeam: (name: string) => api.post('/api/mycelium/teams', { name }) as Promise<{ team: TeamDTO }>,
  inviteBatch: (emails: string[] | string, opts: { teamId?: number; role?: string } = {}) =>
    api.post('/api/mycelium/invite-batch', { emails, ...opts }) as Promise<{
      created: Array<{ email: string; role: string; inviteLink: string }>
      createdCount: number
      skipped: string[]
    }>,
  accept: (token: string) => api.post('/api/mycelium/accept', { token }) as Promise<{ joined: boolean; orgId: number }>,
  getSeats: () => api.get('/api/mycelium/seats') as Promise<{ seats: number; members: number; stripe?: boolean }>,
  setSeats: (seats: number) =>
    api.post('/api/mycelium/seats', { seats }) as Promise<{ seats?: number; checkoutUrl?: string }>,
  climate: (params: { teamId?: number; windowDays?: number } = {}) => {
    const p = new URLSearchParams()
    if (params.teamId) p.set('teamId', String(params.teamId))
    if (params.windowDays) p.set('windowDays', String(params.windowDays))
    const qs = p.toString()
    return api.get(`/api/mycelium/climate${qs ? '?' + qs : ''}`) as Promise<{ climate: ClimateDTO }>
  },
  stats: (params: { teamId?: number; windowDays?: number } = {}) => {
    const p = new URLSearchParams()
    if (params.teamId) p.set('teamId', String(params.teamId))
    if (params.windowDays) p.set('windowDays', String(params.windowDays))
    const qs = p.toString()
    return api.get(`/api/mycelium/stats${qs ? '?' + qs : ''}`) as Promise<StatsDTO>
  },
  membership: () =>
    api.get('/api/mycelium/membership') as Promise<{
      membership: { orgId: number; teamId: number | null; role: string } | null
      org: OrgDTO | null
      team: TeamDTO | null
      profile: WorkProfileDTO | null
      recentCheckins: WorkCheckinDTO[]
      streak: number
    }>,
  saveCheckin: (body: { mood: number; note?: string }) =>
    api.post('/api/mycelium/checkin', body) as Promise<{ checkin: WorkCheckinDTO; saved: boolean }>,
  myCheckins: () => api.get('/api/mycelium/checkin') as Promise<{ checkins: WorkCheckinDTO[] }>,
  getProfile: () => api.get('/api/mycelium/profile') as Promise<{ profile: WorkProfileDTO | null }>,
  saveProfile: (petals: Record<string, number>) =>
    api.post('/api/mycelium/profile', { petals }) as Promise<{ profile: WorkProfileDTO; saved: boolean }>,
  updateCharter: (charter: string | null) =>
    api.patch('/api/mycelium/org/settings', { charter }) as Promise<{ org: OrgDTO; saved: boolean }>,
  launchPulseCampaign: (opts?: { title?: string; message?: string; question?: string }) =>
    api.patch('/api/mycelium/org/settings', { launchPulseCampaign: true, pulseCampaign: opts }) as Promise<{
      org: OrgDTO
      saved: boolean
    }>,
  endPulseCampaign: () =>
    api.patch('/api/mycelium/org/settings', { pulseCampaign: { active: false } }) as Promise<{ org: OrgDTO; saved: boolean }>,
  access: () => api.get('/api/mycelium/access') as Promise<MyceliumAccessDTO>,
  synthesis: (params: { teamId?: number; windowDays?: number; force?: boolean; locale?: string } = {}) =>
    api.post('/api/mycelium/synthesis', params) as Promise<{ synthesis: MyceliumSynthesisDTO; cached: boolean; mock?: boolean }>,
  interviewState: () =>
    api.get('/api/mycelium/interview') as Promise<{
      topics: MyceliumInterviewTopicDTO[]
      active: MyceliumInterviewDTO | null
      recent: MyceliumInterviewDTO[]
    }>,
  interviewStart: (topicSlug: string, locale?: string) =>
    api.post('/api/mycelium/interview', { action: 'start', topicSlug, locale }) as Promise<{
      session: MyceliumInterviewDTO
      turn?: InterviewAiTurnDTO
      resumed?: boolean
    }>,
  interviewReply: (sessionId: number, message: string, locale?: string) =>
    api.post('/api/mycelium/interview', { action: 'reply', sessionId, message, locale }) as Promise<{
      session: MyceliumInterviewDTO
      turn: InterviewAiTurnDTO
    }>,
  interviewComplete: (
    sessionId: number,
    opts: { mood: number; note?: string; locale?: string }
  ) =>
    api.post('/api/mycelium/interview', {
      action: 'complete',
      sessionId,
      mood: opts.mood,
      note: opts.note,
      locale: opts.locale,
    }) as Promise<{ session: MyceliumInterviewDTO; saved: boolean }>,
  interviewAbandon: (sessionId: number) =>
    api.post('/api/mycelium/interview', { action: 'abandon', sessionId }) as Promise<{ abandoned: boolean }>,
}
