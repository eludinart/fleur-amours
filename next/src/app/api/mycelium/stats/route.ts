/**
 * GET /api/mycelium/stats — tableau de bord RH (adoption + climat + alertes).
 * Phase pilote : administrateurs uniquement.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireMyceliumRh } from '@/lib/mycelium-auth'
import { isDbConfigured } from '@/lib/db'
import { getClimateDashboard } from '@/lib/db-aggregates'
import { countMembers, listTeams } from '@/lib/db-organisations'
import { getOrgAdoptionStats } from '@/lib/db-mycelium'
import { buildDimensionAlerts } from '@/lib/mycelium-lexicon'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireMyceliumRh(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    if (!ctx.org) {
      return NextResponse.json({
        org: null,
        role: null,
        teams: [],
        members: 0,
        adoption: {
          totalMembers: 0,
          withProfile: 0,
          withCheckin30d: 0,
          checkinCount30d: 0,
          participationRate: 0,
        },
        dashboard: {
          current: {
            available: false,
            reason: 'no_data',
            respondents: 0,
            threshold: 5,
            petalsAverage: null,
            moodAverage: null,
            eventCount: 0,
            windowDays: 30,
          },
          previous: {
            available: false,
            respondents: 0,
            threshold: 5,
            petalsAverage: null,
            moodAverage: null,
            eventCount: 0,
            windowDays: 30,
          },
          moodDelta: null,
          participationRate: 0,
          totalMembers: 0,
        },
        alerts: [],
        needsOrg: true,
      })
    }

    const teamIdRaw = req.nextUrl.searchParams.get('teamId')
    const windowRaw = req.nextUrl.searchParams.get('windowDays')
    const teamId = teamIdRaw ? parseInt(teamIdRaw, 10) : null
    const windowDays = windowRaw ? parseInt(windowRaw, 10) : 30

    const [members, adoption, teams, dashboard] = await Promise.all([
      countMembers(ctx.org.id),
      getOrgAdoptionStats(ctx.org.id),
      listTeams(ctx.org.id),
      getClimateDashboard({
        orgId: ctx.org.id,
        teamId,
        windowDays,
        totalMembers: await countMembers(ctx.org.id),
      }),
    ])

    const alerts = buildDimensionAlerts(
      dashboard.current.petalsAverage,
      dashboard.previous.petalsAverage
    )

    return NextResponse.json({
      org: ctx.org,
      role: ctx.role,
      teams,
      members,
      adoption,
      dashboard,
      alerts,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
