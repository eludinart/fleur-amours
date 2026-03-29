/**
 * GET /api/fleur-beta/result/[id]
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getFleurBetaResult } from '@/lib/db-fleur-beta'
import { requireAuth, ApiError } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré (MARIADB_*)' }, { status: 503 })
    }

    const { userId } = await requireAuth(req)
    const data = await getFleurBetaResult(parseInt(id, 10), userId)
    if (!data) {
      return NextResponse.json({ error: 'Résultat introuvable' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
