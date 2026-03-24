/**
 * POST /api/tarot_readings/update
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { update } from '@/lib/db-tarot'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const id = parseInt(String(body.id ?? 0), 10)
    const payload = body.payload

    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }
    if (payload === undefined || payload === null) {
      return NextResponse.json({ error: 'payload requis' }, { status: 400 })
    }

    const updated = await update(id, typeof payload === 'object' ? payload : {}, userId)
    if (!updated) {
      return NextResponse.json({ error: 'Tirage introuvable ou non autorisé' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
