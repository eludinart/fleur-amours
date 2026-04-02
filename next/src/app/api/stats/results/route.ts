/**
 * GET /api/stats/results — liste paginée des passations racine (admin)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { listPassationRoots } from '@/lib/db-fleur-passation-stats'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const sp = req.nextUrl.searchParams
    const page = parseInt(sp.get('page') ?? '1', 10) || 1
    const perPage = parseInt(sp.get('per_page') ?? '20', 10) || 20
    const search = sp.get('search') ?? undefined
    const soloOnly = sp.get('solo_only') === 'true'
    const duoOnly = sp.get('duo_only') === 'true'
    const data = await listPassationRoots({
      page,
      perPage,
      search,
      soloOnly,
      duoOnly,
    })
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ detail: err.message }, { status: err.status })
    }
    const e = err as Error
    return NextResponse.json({ detail: e?.message || 'Erreur serveur.' }, { status: 500 })
  }
}
