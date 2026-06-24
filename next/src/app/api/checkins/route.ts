/**
 * GET  /api/checkins  — liste + contexte (suggestions, dernier écho)
 * POST /api/checkins  — enregistre un écho du jour
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { isDbConfigured } from '@/lib/db'
import { getMyCheckins, hasCheckinToday, saveCheckin } from '@/lib/db-checkins'
import { recordTimelineEvent } from '@/lib/db-timeline'
import { buildCheckinContext, highlightPetalToArray, type CheckinEchoResponse } from '@/lib/checkin-echo'

export const dynamic = 'force-dynamic'

function resolveLocale(req: NextRequest): string {
  return (req.headers.get('x-locale') || req.headers.get('X-Locale') || 'fr').toLowerCase().slice(0, 5)
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!isDbConfigured()) {
      return NextResponse.json({ checkins: [], context: null })
    }
    const locale = resolveLocale(req)
    const user = await authMe(uid).catch(() => null)
    const [checkins, context] = await Promise.all([
      getMyCheckins(uid),
      buildCheckinContext(uid, user?.email ?? null, locale),
    ])
    return NextResponse.json({ checkins, context })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, checkins: [], context: null }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    if (await hasCheckinToday(uid)) {
      return NextResponse.json(
        { error: 'Un seul écho par jour est possible.', code: 'CHECKIN_DAILY_LIMIT' },
        { status: 409 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as {
      mood?: number
      tension?: number
      note?: string
      intention?: string
      highlightPetal?: string
      aiResponse?: CheckinEchoResponse
      feltAfter?: number
    }

    const aiResponse = body.aiResponse ?? null
    const saved = await saveCheckin({
      userId: uid,
      mood: body.mood,
      tension: body.tension,
      note: body.note ?? aiResponse?.whisper ?? null,
      intention: body.intention ?? null,
      highlightPetal: body.highlightPetal ?? aiResponse?.highlight_petal ?? null,
      aiResponse,
      feltAfter: body.feltAfter,
    })

    const summary =
      aiResponse?.whisper?.trim() ||
      (body.intention ? String(body.intention).slice(0, 280) : null) ||
      (body.note ? String(body.note).slice(0, 280) : null)

    const petalId = body.highlightPetal ?? aiResponse?.highlight_petal ?? null

    void recordTimelineEvent({
      userId: uid,
      source: 'checkin',
      refId: saved.id,
      title: 'Écho du jour',
      summary,
      petals: petalId ? highlightPetalToArray(petalId) : null,
      mood: saved.mood,
    }).catch(() => {})

    return NextResponse.json({ ...saved, saved: true }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
