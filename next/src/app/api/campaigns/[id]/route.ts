/**
 * GET /api/campaigns/:id
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getCampaign } from '@/lib/db-campaigns'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(req)
    const { id } = await ctx.params
    const campaignId = parseInt(id, 10)
    if (!campaignId) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    if (!isDbConfigured()) return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    const campaign = await getCampaign(campaignId)
    if (!campaign) return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    return NextResponse.json(campaign)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
