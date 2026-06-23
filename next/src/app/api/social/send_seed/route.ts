/**
 * POST /api/social/send_seed
 * Dépose une graine (demande de contact) vers un autre utilisateur.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { sendSeed } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const targetUserId = parseInt(String(body.targetUserId ?? body.target_user_id ?? 0), 10)
    const intentionId = String(body.intentionId ?? body.intention_id ?? '').trim()
    if (!targetUserId || !intentionId) {
      return NextResponse.json(
        { error: 'targetUserId et intentionId requis' },
        { status: 400 }
      )
    }
    const fromUserId = parseInt(userId, 10)
    if (!fromUserId) {
      return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        { status: 'ok', alignment: 'high', sapDebited: 0, firstFree: true, seedId: 0 },
        { status: 201 }
      )
    }

    const { seedId, firstFree } = await sendSeed(fromUserId, targetUserId, intentionId)
    return NextResponse.json(
      { status: 'ok', alignment: 'high', sapDebited: firstFree ? 0 : 5, firstFree, seedId },
      { status: 201 }
    )
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string }
    return NextResponse.json(
      {
        error: e.message ?? 'Erreur lors de l\'envoi de la graine',
        code: e.code ?? null,
      },
      { status: e.status || (e.code === 'seed_cooldown' ? 429 : e.code === 'social_focus' ? 423 : 400) }
    )
  }
}
