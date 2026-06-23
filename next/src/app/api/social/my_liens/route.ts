/**
 * GET /api/social/my_liens
 * Agrège les relations communautaires (graines, canaux, arrosages, pollens)
 * en une seule entrée par jardinier, classée par activité et priorité.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getMyLiens } from '@/lib/db-social'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ liens: [] }, { status: 200 })
    }

    const data = await getMyLiens(userId)
    return NextResponse.json({ liens: data.liens })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
