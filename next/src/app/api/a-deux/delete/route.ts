/**
 * POST /api/a-deux/delete
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { deleteAnchor, deletePairing } from '@/lib/db-a-deux'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as { type?: string; id?: number }
    const id = Number(body.id ?? 0)
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const ok =
      body.type === 'pairing' ? await deletePairing(id, uid) : await deleteAnchor(id, uid)
    if (!ok) return NextResponse.json({ error: 'Suppression impossible' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as Error
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
