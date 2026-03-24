/**
 * GET /api/fleur/answers/[id]
 * Récupère les réponses d'un résultat Fleur depuis MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getAnswers } from '@/lib/db-fleur'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Backend non configuré (MARIADB_*)' },
        { status: 503 }
      )
    }

    const data = await getAnswers(parseInt(id, 10), userId)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e.status ?? 500
    return NextResponse.json(
      { error: e.message ?? 'Réponses introuvables' },
      { status }
    )
  }
}
