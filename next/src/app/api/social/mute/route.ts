/**
 * POST /api/social/mute
 * Active ou retire une sourdine sur un autre jardinier (B5).
 *
 * Body : { target_user_id: number, mute?: boolean (default true) }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { setMute } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const meId = parseInt(userId, 10)
    if (!meId) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const targetId = parseInt(String(body.target_user_id ?? body.targetUserId ?? 0), 10)
    const mute = body.mute === undefined ? true : Boolean(body.mute)
    if (!targetId) return NextResponse.json({ error: 'target_user_id requis' }, { status: 400 })
    if (targetId === meId) return NextResponse.json({ error: 'Cible invalide' }, { status: 400 })

    if (!isDbConfigured()) {
      return NextResponse.json({ status: 'ok', muted: mute }, { status: 200 })
    }

    const res = await setMute(meId, targetId, mute)
    return NextResponse.json({ status: 'ok', ...res }, { status: 200 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message ?? 'Erreur lors de la mise en sourdine' },
      { status: e.status || 400 }
    )
  }
}
