/**
 * GET /api/mycelium/membership — appartenance org + espace employé.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireMyceliumMember } from '@/lib/mycelium-auth'
import { isDbConfigured } from '@/lib/db'
import { listTeams } from '@/lib/db-organisations'
import { getWorkProfile, getMyWorkCheckins, getUserStreak } from '@/lib/db-mycelium'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { uid, membership, org } = await requireMyceliumMember(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ membership: null, org: null })
    }
    const [teams, profile, recentCheckins, streak] = await Promise.all([
      listTeams(membership.orgId),
      getWorkProfile(uid, membership.orgId),
      getMyWorkCheckins(uid, 5),
      getUserStreak(uid, membership.orgId),
    ])
    const team = teams.find((t) => t.id === membership.teamId) ?? null
    return NextResponse.json({
      membership: {
        orgId: membership.orgId,
        teamId: membership.teamId,
        role: membership.role,
      },
      org,
      team,
      profile,
      recentCheckins,
      streak,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
