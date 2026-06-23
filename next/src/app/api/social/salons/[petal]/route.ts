/**
 * GET/POST /api/social/salons/[petal]
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getSalonMessages, postSalonMessage, getSalonPostStatus } from '@/lib/db-salons'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ petal: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })

    const { petal } = await params

    if (!isDbConfigured()) {
      return NextResponse.json({ messages: [], postStatus: { remainingToday: 8, dailyLimit: 8 } })
    }

    const [messages, postStatus] = await Promise.all([
      getSalonMessages(petal, 50),
      getSalonPostStatus(uid),
    ])
    return NextResponse.json({ messages, postStatus, salonId: petal })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ petal: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })

    const { petal } = await params
    const body = await req.json().catch(() => ({}))
    const text = String(body.body ?? body.message ?? '').trim()

    if (!isDbConfigured()) {
      return NextResponse.json({ id: 0, salonId: petal, body: text, createdAt: new Date().toISOString() })
    }

    const msg = await postSalonMessage(uid, petal, text)
    return NextResponse.json(msg, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string }
    return NextResponse.json(
      { error: e.message, code: e.code ?? null },
      { status: e.status || (e.code === 'salon_daily_limit' ? 429 : 400) }
    )
  }
}
