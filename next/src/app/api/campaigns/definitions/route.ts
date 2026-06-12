/**
 * GET /api/campaigns/definitions — POST /api/campaigns/definitions
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { createCampaignDefinition, listCampaignDefinitions } from '@/lib/db-campaigns'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    if (!isDbConfigured()) return NextResponse.json({ definitions: [] })
    const definitions = await listCampaignDefinitions()
    return NextResponse.json({ definitions })
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
    const body = (await req.json().catch(() => ({}))) as { label?: string; slug?: string }
    const result = await createCampaignDefinition({
      label: String(body.label ?? ''),
      slug: body.slug,
    })
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
