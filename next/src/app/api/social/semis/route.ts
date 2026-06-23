/**
 * GET/POST /api/social/semis — flux anonyme de pépite (1/jour).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getSemisFeed, getSemisStatus, postSemis } from '@/lib/db-semis'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })

    const petalId = req.nextUrl.searchParams.get('petal_id') || req.nextUrl.searchParams.get('petalId')

    if (!isDbConfigured()) {
      return NextResponse.json({ items: [], status: { canPostToday: true, todaySemis: null } })
    }

    const [items, status] = await Promise.all([
      getSemisFeed({ petalId, limit: 40 }),
      getSemisStatus(uid),
    ])
    return NextResponse.json({ items, status })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const petalId = String(body.petalId ?? body.petal_id ?? '').trim()
    const text = String(body.body ?? body.text ?? '').trim()

    if (!isDbConfigured()) {
      return NextResponse.json({ id: 0, petalId, body: text, createdAt: new Date().toISOString() })
    }

    const item = await postSemis(uid, petalId, text)
    return NextResponse.json(item, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string }
    return NextResponse.json(
      { error: e.message, code: e.code ?? null },
      { status: e.status || (e.code === 'semis_daily_limit' ? 429 : 400) }
    )
  }
}
