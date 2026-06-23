/**
 * POST /api/paper-draw/save
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { savePaperDraw } from '@/lib/db-paper-draw'
import { isDbConfigured } from '@/lib/db'
import { incrementMonthlyUsage } from '@/lib/db-usage'
import { recordTimelineEvent } from '@/lib/db-timeline'
import { buildPaperDrawChronicleSummary, paperDrawTimelineTitle } from '@/lib/chronicle-summary'
import type { PaperDrawLayoutId } from '@/lib/paper-draw-layouts'

export const dynamic = 'force-dynamic'

const VALID_LAYOUTS = new Set([
  'one',
  'two',
  'three',
  'four_doors',
  'flower_8',
  'free',
])

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const layoutRaw = String(body.layout_template ?? 'free')
    const layout_template = VALID_LAYOUTS.has(layoutRaw)
      ? (layoutRaw as PaperDrawLayoutId)
      : 'free'
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {}

    let email: string | null = null
    try {
      const user = await authMe(uid)
      email = user.email || null
    } catch {
      /* ignore */
    }

    const saved = await savePaperDraw({
      user_id: uid,
      email,
      layout_template,
      payload,
    })

    const savedId = Number((saved as { id?: unknown })?.id) || null
    void incrementMonthlyUsage(uid, { tirages: 1 })

    void recordTimelineEvent({
      userId: uid,
      source: 'paper_draw',
      refId: savedId,
      title: paperDrawTimelineTitle(layout_template),
      summary: buildPaperDrawChronicleSummary({
        ...payload,
        layout_template,
      })?.slice(0, 280) || null,
    }).catch(() => {})

    return NextResponse.json(saved, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
