/**
 * GET  /api/dyads/rituals  — rituels de la dyade
 * POST /api/dyads/rituals  — crée un rituel  { title, kind?, cadenceDays? }
 *                            ou complète      { action: 'complete', ritualId }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { completeRitual, createRitual, getMyDyad, listRituals, userInDyad } from '@/lib/db-dyads'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!isDbConfigured()) return NextResponse.json({ rituals: [] })
    const dyad = await getMyDyad(uid)
    if (!dyad || !userInDyad(dyad, uid)) return NextResponse.json({ rituals: [] })
    const rituals = await listRituals(dyad.id)
    return NextResponse.json({ rituals })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, rituals: [] }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const dyad = await getMyDyad(uid)
    if (!dyad || dyad.status !== 'active' || !userInDyad(dyad, uid)) {
      return NextResponse.json({ error: 'Aucune dyade active' }, { status: 404 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      action?: string
      ritualId?: number
      title?: string
      kind?: string
      cadenceDays?: number
    }

    if (body.action === 'complete') {
      const ritualId = parseInt(String(body.ritualId ?? 0), 10)
      if (!ritualId) return NextResponse.json({ error: 'ritualId requis' }, { status: 400 })
      await completeRitual(ritualId, dyad.id)
      return NextResponse.json({ completed: true })
    }

    const title = String(body.title ?? '').trim()
    if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
    const { id } = await createRitual({
      dyadId: dyad.id,
      title,
      kind: body.kind,
      cadenceDays: body.cadenceDays,
    })
    return NextResponse.json({ id, created: true }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
