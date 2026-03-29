/**
 * POST /api/fleur-beta/delete — body { id: number }
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { deleteFleurBetaResult } from '@/lib/db-fleur-beta'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as { id?: number }
    const id = Number(body?.id)
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }
    const ok = await deleteFleurBetaResult(id, parseInt(userId, 10))
    if (!ok) {
      return NextResponse.json({ error: 'Suppression impossible' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
