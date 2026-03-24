/**
 * GET /api/fleur/result/[id]
 * Récupère un résultat Fleur existant depuis MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getResult } from '@/lib/db-fleur'
import { getUserIdFromRequest } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const userId = getUserIdFromRequest(req)
    const data = await getResult(parseInt(id, 10), userId ?? undefined)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e.status ?? 500
    return NextResponse.json(
      { error: e.message ?? 'Résultat introuvable' },
      { status }
    )
  }
}
