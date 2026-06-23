/**
 * POST /api/social/constellation/create
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { createConstellation } from '@/lib/db-constellations'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const title = body.title ? String(body.title) : undefined
    const petalId = body.petalId ?? body.petal_id ?? null

    if (!isDbConfigured()) {
      return NextResponse.json({ token: 'demo', memberCount: 1, maxMembers: 5 })
    }

    const detail = await createConstellation(uid, { title, petalId })
    return NextResponse.json(detail, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string }
    return NextResponse.json(
      { error: e.message, code: e.code ?? null },
      { status: e.status || 400 }
    )
  }
}
