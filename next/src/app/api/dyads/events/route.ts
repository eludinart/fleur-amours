/**
 * POST /api/dyads/events — ajoute un message au fil partagé de la dyade.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { addDyadEvent, getMyDyad, userInDyad } from '@/lib/db-dyads'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as { content?: string }
    const content = String(body.content ?? '').trim()
    if (!content) return NextResponse.json({ error: 'Message vide' }, { status: 400 })

    const dyad = await getMyDyad(uid)
    if (!dyad || dyad.status !== 'active' || !userInDyad(dyad, uid)) {
      return NextResponse.json({ error: 'Aucune dyade active' }, { status: 404 })
    }
    const { id } = await addDyadEvent({ dyadId: dyad.id, authorId: uid, type: 'message', content })
    return NextResponse.json({ id, saved: true }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
