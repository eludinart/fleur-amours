/**
 * GET /api/notifications/campaign/[id] — contenu HTML d'une campagne e-mail reçue.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getCampaignEmailForUser } from '@/lib/db-broadcasts'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { id: idStr } = await ctx.params
    const broadcastId = parseInt(idStr, 10)
    if (!broadcastId) {
      return NextResponse.json({ error: 'Campagne invalide' }, { status: 400 })
    }

    const data = await getCampaignEmailForUser({
      broadcastId,
      userId: parseInt(userId, 10),
    })
    if (!data) {
      return NextResponse.json({ error: 'Message introuvable' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
