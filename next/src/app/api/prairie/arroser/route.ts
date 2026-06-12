/**
 * POST /api/prairie/arroser
 * Offre une goutte de rosée à un autre jardinier (coûte 1 point).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { arroseFleur } from '@/lib/db-prairie'

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
    if (!toUserId) {
      return NextResponse.json({ error: 'to_user_id requis' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré (MARIADB_*)' }, { status: 503 })
    }

    const result = await arroseFleur(fromUserId, toUserId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    const msg = e.message ?? 'Erreur lors de l\'arrosage'
    const status = msg.includes('gouttes') ? 400 : e.status || 400
    return NextResponse.json({ error: msg }, { status })
  }
}
