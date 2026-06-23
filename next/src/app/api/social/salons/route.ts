/**
 * GET /api/social/salons — résumé des 8 salons pétales.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { listSalonSummaries, getSalonPostStatus } from '@/lib/db-salons'
import { PETAL_IDS } from '@/lib/grand-jardin-view'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })

    if (!isDbConfigured()) {
      return NextResponse.json({
        salons: PETAL_IDS.map((id) => ({ salonId: id, messagesToday: 0, lastMessageAt: null })),
        postStatus: { remainingToday: 8, dailyLimit: 8 },
      })
    }

    const [salons, postStatus] = await Promise.all([listSalonSummaries(), getSalonPostStatus(uid)])
    return NextResponse.json({ salons, postStatus })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
