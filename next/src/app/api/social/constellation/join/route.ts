/**
 * POST /api/social/constellation/join
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { joinConstellation } from '@/lib/db-constellations'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const token = String(body.token ?? '').trim()
    if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })

    if (!isDbConfigured()) {
      return NextResponse.json({ token, isMember: true, memberCount: 2 })
    }

    const detail = await joinConstellation(uid, token)
    return NextResponse.json(detail)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string }
    return NextResponse.json(
      { error: e.message, code: e.code ?? null },
      { status: e.status || 400 }
    )
  }
}
