/**
 * GET /api/user/my_coaches
 * Liste les coachs acceptés qui suivent le user courant (via fleur_social_seeds).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getUserCoaches } from '@/lib/db-coach-patients'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ coaches: [] }, { status: 200 })
    }

    const data = await getUserCoaches(Number(userId))
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status || 401 })
  }
}

