/**
 * POST /api/social/report
 * Signale un autre jardinier (B5). Met automatiquement la cible en sourdine.
 *
 * Body : { target_user_id: number, reason: string, detail?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { reportUser } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const meId = parseInt(userId, 10)
    if (!meId) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const targetId = parseInt(String(body.target_user_id ?? body.targetUserId ?? 0), 10)
    const reason = String(body.reason ?? '').trim()
    const detail = body.detail ? String(body.detail) : undefined
    if (!targetId) return NextResponse.json({ error: 'target_user_id requis' }, { status: 400 })
    if (!reason) return NextResponse.json({ error: 'reason requis' }, { status: 400 })
    if (targetId === meId) return NextResponse.json({ error: 'Cible invalide' }, { status: 400 })

    if (!isDbConfigured()) {
      return NextResponse.json({ status: 'ok', reportId: 0, muted: true }, { status: 201 })
    }

    const res = await reportUser(meId, targetId, reason, detail)
    return NextResponse.json({ status: 'ok', ...res, muted: true }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message ?? 'Erreur lors du signalement' },
      { status: e.status || 400 }
    )
  }
}
