/**
 * GET /api/stats/averages — moyennes des scores par pétale (passations racine, admin)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { getPassationStatsAverages } from '@/lib/db-fleur-passation-stats'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const since = req.nextUrl.searchParams.get('since')
    const data = await getPassationStatsAverages(since)
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ detail: err.message }, { status: err.status })
    }
    const e = err as Error
    return NextResponse.json({ detail: e?.message || 'Erreur serveur.' }, { status: 500 })
  }
}
