/**
 * GET /api/fleur/result/[id]
 * Récupère un résultat Fleur existant depuis MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getResult } from '@/lib/db-fleur'
import { requireAuth, ApiError } from '@/lib/api-auth'

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
    const resultId = parseInt(id, 10)
    if (!Number.isFinite(resultId) || resultId <= 0) {
      return NextResponse.json({ error: 'id invalide' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Backend non configuré (MARIADB_*)' },
        { status: 503 }
      )
    }

    // L'ownership est vérifié dans getResult uniquement si userId est fourni.
    // On force l'auth pour éviter l'IDOR par énumération d'ID sans JWT.
    const { userId } = await requireAuth(req)
    let data: Awaited<ReturnType<typeof getResult>>
    try {
      data = await getResult(resultId, userId)
    } catch (err: unknown) {
      const e = err as Error
      const msg = (e?.message ?? '').toLowerCase()
      if (msg.includes('not found') || msg.includes('introuvable')) {
        return NextResponse.json({ error: 'Résultat introuvable' }, { status: 404 })
      }
      if (msg.includes('accès non autorisé') || msg.includes('non autoris')) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
      }
      throw err
    }
    return NextResponse.json(data)
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const e = err as Error & { status?: number }
    const status = e.status ?? 500
    return NextResponse.json(
      { error: e.message ?? 'Résultat introuvable' },
      { status }
    )
  }
}
