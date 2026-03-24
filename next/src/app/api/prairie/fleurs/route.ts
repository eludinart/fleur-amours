/**
 * GET /api/prairie/fleurs
 * Charge les fleurs et liens du Grand Jardin depuis MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getFleurs } from '@/lib/db-prairie'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json(
        { fleurs: [], links: [], me_fleur: null },
        { status: 200 }
      )
    }

    const data = await getFleurs(userId)
    return NextResponse.json({
      fleurs: data.fleurs,
      links: data.links,
      me_fleur: data.me_fleur,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
