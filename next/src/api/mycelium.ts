import { api } from '@/lib/api-client'

export type OrgDTO = { id: number; name: string; ownerUserId: number; createdAt: string }
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
}
