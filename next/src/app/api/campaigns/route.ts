/**
 * GET /api/campaigns — POST /api/campaigns
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { createCampaign, listCampaigns } from '@/lib/db-campaigns'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    if (!isDbConfigured()) return NextResponse.json({ campaigns: [], total: 0 })
    const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10) || 1
    const per_page = parseInt(req.nextUrl.searchParams.get('per_page') ?? '15', 10) || 15
    const data = await listCampaigns({ page, per_page })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      definition_id?: number
      recipient_emails?: string[]
      token_ttl_hours?: number
    }
    const emails = Array.isArray(body.recipient_emails) ? body.recipient_emails : []
    const result = await createCampaign({
      definition_id: Number(body.definition_id),
      recipient_emails: emails,
      token_ttl_hours: body.token_ttl_hours,
    })
    return NextResponse.json({ ok: true, tokens: result.tokens, campaign_id: result.campaign_id }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
