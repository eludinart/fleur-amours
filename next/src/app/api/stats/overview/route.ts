/**
 * GET /api/stats/overview — agrégats passations Fleur (admin)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { getPassationStatsOverview } from '@/lib/db-fleur-passation-stats'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const data = await getPassationStatsOverview()
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ detail: err.message }, { status: err.status })
    }
    const e = err as Error
    return NextResponse.json({ detail: e?.message || 'Erreur serveur.' }, { status: 500 })
  }
}
