import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { save } from '@/lib/db-dreamscape'
import { requireAuth } from '@/lib/api-auth'
import { recordTimelineEvent } from '@/lib/db-timeline'
import { buildDreamscapeChronicleSummary } from '@/lib/chronicle-summary'
import { PETAL_ORDER_IDS } from '@/lib/petal-theme'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const body = await req.json()
    const result = await save(userId, body)
    const uid = parseInt(userId, 10)
    const savedId = Number((result as { id?: unknown })?.id) || null
    const petalsRaw = body?.petals as Record<string, number> | undefined
    const petalsArr = petalsRaw
      ? PETAL_ORDER_IDS.map((id) => Math.min(1, Math.max(0, Number(petalsRaw[id]) || 0)))
      : null
    void recordTimelineEvent({
      userId: uid,
      source: 'dreamscape',
      refId: savedId,
      title: 'Promenade onirique',
      summary: buildDreamscapeChronicleSummary({
        poeticReflection: body?.poeticReflection,
        history: body?.history,
      }).slice(0, 280),
      petals: petalsArr,
    }).catch(() => {})

    return NextResponse.json({ ...result, saved: true }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 401 }
    )
  }
}
