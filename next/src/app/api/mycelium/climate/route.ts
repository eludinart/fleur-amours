/**
 * GET /api/mycelium/climate — reporting climat agrégé et anonymisé.
 * Jamais de données individuelles : agrégation via db-aggregates avec seuil de
 * k-anonymat (renvoie available:false si trop peu de répondants).
 * Query : ?teamId=123&windowDays=30
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getManagedOrg } from '@/lib/db-organisations'
import { getTeamClimate } from '@/lib/db-aggregates'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const managed = await getManagedOrg(parseInt(userId, 10))
    if (!managed) return NextResponse.json({ error: 'Aucune organisation gérée' }, { status: 403 })

    const teamIdRaw = req.nextUrl.searchParams.get('teamId')
    const windowRaw = req.nextUrl.searchParams.get('windowDays')
    const teamId = teamIdRaw ? parseInt(teamIdRaw, 10) : null
    const windowDays = windowRaw ? parseInt(windowRaw, 10) : 30

    const climate = await getTeamClimate({ orgId: managed.org.id, teamId, windowDays })
    return NextResponse.json({ climate })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
