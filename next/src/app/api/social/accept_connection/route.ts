/**
 * POST /api/social/accept_connection
 * Accepte une graine, crée le lien et le canal, retourne channelId.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { acceptSeedConnection } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const seedId = parseInt(String(body.seedId ?? body.seed_id ?? 0), 10)
    if (!seedId) {
      return NextResponse.json({ error: 'seedId requis' }, { status: 400 })
    }
    const acceptorUserId = parseInt(userId, 10)
    if (!acceptorUserId) {
      return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ status: 'ok', channelId: 0 }, { status: 200 })
    }

    const { channelId } = await acceptSeedConnection(seedId, acceptorUserId)
    return NextResponse.json({ status: 'ok', channelId })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message ?? 'Erreur lors de l\'acceptation' },
      { status: e.status || 400 }
    )
  }
}
