/**
 * GET /api/campaigns/:id/results
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getCampaignResults } from '@/lib/db-campaigns'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin(req)
    const { id } = await ctx.params
    const campaignId = parseInt(id, 10)
    if (!campaignId) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    if (!isDbConfigured()) return NextResponse.json({ results: [] })
    const results = await getCampaignResults(campaignId)
    return NextResponse.json({ results })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
