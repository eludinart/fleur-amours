/**
 * GET /api/fleur/my-results
 * Liste les explorations Fleur et DUO de l'utilisateur connecté depuis MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getMyResults } from '@/lib/db-fleur'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Backend non configuré (MARIADB_*)' },
        { status: 503 }
      )
    }

    const data = await getMyResults(userId)
    return NextResponse.json({ items: data.items })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e.status ?? 500
    return NextResponse.json(
      { error: e.message ?? 'Impossible de charger vos fleurs' },
      { status }
    )
  }
}
