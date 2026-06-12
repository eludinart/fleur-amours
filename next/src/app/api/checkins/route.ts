/**
 * GET  /api/checkins  — liste des check-ins de l'utilisateur
 * POST /api/checkins  — enregistre un check-in (humeur, tension, note)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getMyCheckins, saveCheckin } from '@/lib/db-checkins'
import { recordTimelineEvent } from '@/lib/db-timeline'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) return NextResponse.json({ checkins: [] })
    const checkins = await getMyCheckins(parseInt(userId, 10))
    return NextResponse.json({ checkins })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, checkins: [] }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      mood?: number
      tension?: number
      note?: string
    }
    const saved = await saveCheckin({
      userId: uid,
      mood: body.mood,
      tension: body.tension,
      note: body.note ?? null,
    })

    void recordTimelineEvent({
      userId: uid,
      source: 'checkin',
      refId: saved.id,
      title: 'Check-in',
      summary: body.note ? String(body.note).slice(0, 280) : null,
      mood: saved.mood,
    }).catch(() => {})

    return NextResponse.json({ ...saved, saved: true }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
