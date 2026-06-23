/**
 * POST /api/paper-draw/update
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { updatePaperDraw } from '@/lib/db-paper-draw'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const id = parseInt(String(body.id ?? ''), 10)
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 422 })
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {}

    const ok = await updatePaperDraw({ id, user_id: uid, payload })
    if (!ok) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
