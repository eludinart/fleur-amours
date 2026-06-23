/**
 * GET /api/prairie/pouls
 * Pouls du jardin : compteurs anonymes (arrosages, pollens, jardiniers en ligne,
 * pétale dominant cette semaine, dernières éclosions publiques).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getJardinPouls } from '@/lib/db-prairie'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json(
        {
          arrosagesToday: 0,
          pollensToday: 0,
          jardiniersOnline: 0,
          jardiniersPublicTotal: 0,
          fleursWeek: 0,
          dominantPetalToday: null,
          recentEclosions: [],
        },
        { status: 200 }
      )
    }

    const uid = parseInt(userId, 10)
    const pouls = await getJardinPouls(uid)
    return NextResponse.json(pouls)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
