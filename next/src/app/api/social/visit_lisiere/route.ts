/**
 * GET /api/social/visit_lisiere
 * Visite la Lisière d'un utilisateur (profil public, relation, graines).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { visitLisiere } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId: visitorId } = await requireAuth(req)
    const targetUserIdParam = req.nextUrl.searchParams.get('user_id')
    if (!targetUserIdParam) {
      return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
    }
    const visitorUserId = parseInt(visitorId, 10)
    const targetUserId = parseInt(targetUserIdParam, 10)
    if (!visitorUserId || !targetUserId) {
      return NextResponse.json({ error: 'user_id invalide' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({
        userId: String(targetUserId),
        pseudo: '',
        avatarEmoji: '🌸',
        fleurMoyenne: { petals: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3] },
        relationStatusWithVisitor: 'none',
      })
    }

    const data = await visitLisiere(visitorUserId, targetUserId)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message ?? 'Erreur lors de la visite' },
      { status: e.status || 404 }
    )
  }
}
