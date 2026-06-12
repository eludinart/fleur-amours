/**
 * GET  /api/onboarding/baseline  — ligne de base de l'utilisateur (ou null)
 * POST /api/onboarding/baseline  — enregistre la ligne de base (1ère fois)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getBaseline, saveBaseline } from '@/lib/db-baseline'
import { recordTimelineEvent } from '@/lib/db-timeline'
import { PETAL_ORDER_IDS } from '@/lib/petal-theme'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) return NextResponse.json({ baseline: null })
    const baseline = await getBaseline(parseInt(userId, 10))
    return NextResponse.json({ baseline })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, baseline: null }, { status: e.status || 401 })
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
      petals?: Record<string, number>
      intention?: string
    }
    const { created, baseline } = await saveBaseline({
      userId: uid,
      petals: body.petals ?? {},
      intention: body.intention ?? null,
    })

    if (created) {
      const petalsArr = PETAL_ORDER_IDS.map((id) => baseline.petals[id] ?? 0)
      void recordTimelineEvent({
        userId: uid,
        source: 'onboarding',
        refId: uid,
        title: 'Ligne de base',
        summary: baseline.intention ? String(baseline.intention).slice(0, 280) : null,
        petals: petalsArr,
      }).catch(() => {})
    }

    return NextResponse.json({ created, baseline })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
