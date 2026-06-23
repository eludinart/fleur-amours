/**
 * GET /api/social/constellation/[token]
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getConstellationByToken } from '@/lib/db-constellations'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })

    const { token } = await params
    if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })

    if (!isDbConfigured()) {
      return NextResponse.json({
        token,
        memberCount: 0,
        maxMembers: 5,
        isMember: false,
        members: [],
        groupScores: {},
        messages: [],
      })
    }

    const detail = await getConstellationByToken(token, uid)
    if (!detail) return NextResponse.json({ error: 'Constellation introuvable' }, { status: 404 })
    return NextResponse.json(detail)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
