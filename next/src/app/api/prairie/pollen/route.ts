/**
 * POST /api/prairie/pollen
 * Envoie une carte (pollen) à un autre jardinier.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { sendPollen } from '@/lib/db-prairie'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const fromUserId = parseInt(userId, 10)
    if (!fromUserId) {
      return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const toUserId = parseInt(String(body.to_user_id ?? body.toUserId ?? 0), 10)
    const cardSlug = String(body.card_slug ?? body.cardSlug ?? '').trim()
    if (!toUserId || !cardSlug) {
      return NextResponse.json({ error: 'to_user_id et card_slug requis' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré (MARIADB_*)' }, { status: 503 })
    }

    const result = await sendPollen(fromUserId, toUserId, cardSlug)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur lors de l\'envoi du pollen' }, { status: e.status || 400 })
  }
}
