/**
 * POST /api/tarot_readings/save
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { save } from '@/lib/db-tarot'
import { isDbConfigured } from '@/lib/db'
import { incrementMonthlyUsage } from '@/lib/db-usage'
import { recordTimelineEvent } from '@/lib/db-timeline'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const type = ['simple', 'four'].includes(String(body.type ?? '')) ? body.type : 'simple'
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {}

    let email: string | null = null
    try {
      const user = await authMe(uid)
      email = user.email || null
    } catch {
      /* ignore */
    }

    const saved = await save({
      user_id: uid,
      email,
      type,
      payload,
    })

    void incrementMonthlyUsage(uid, { tirages: 1 })

    // Timeline (Éclosion) : journaliser le tirage.
    const savedId = Number((saved as { id?: unknown })?.id) || null
    void recordTimelineEvent({
      userId: uid,
      source: 'tirage',
      refId: savedId,
      title: type === 'four' ? 'Tirage des 4 Portes' : 'Tirage de carte',
      summary: null,
    }).catch(() => {})

    return NextResponse.json(saved, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
