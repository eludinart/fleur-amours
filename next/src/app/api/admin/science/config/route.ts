/**
 * GET/POST /api/admin/science/config
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { getScienceConfig, setScienceConfig } from '@/lib/science-db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const { config, db_configured } = await getScienceConfig()
    return NextResponse.json({ config, db_configured })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const partial: any = {}
    // Booleans
    partial.include_petals_aggregate = body.include_petals_aggregate
    partial.include_dreamscape = body.include_dreamscape
    partial.include_solo_fleur = body.include_solo_fleur
    partial.include_tarot_1card = body.include_tarot_1card
    partial.include_tarot_4doors = body.include_tarot_4doors
    partial.include_ma_fleur = body.include_ma_fleur
    partial.include_duo = body.include_duo
    partial.include_chat_clairiere = body.include_chat_clairiere
    partial.include_chat_coach = body.include_chat_coach
    partial.include_fleur_beta = body.include_fleur_beta

    // Numbers
    if (body.confidence_min_facts != null) partial.confidence_min_facts = Number(body.confidence_min_facts)
    if (body.confidence_low_max != null) partial.confidence_low_max = Number(body.confidence_low_max)
    if (body.confidence_medium_max != null) partial.confidence_medium_max = Number(body.confidence_medium_max)
    if (body.evidence_initial_max_messages != null) partial.evidence_initial_max_messages = Number(body.evidence_initial_max_messages)
    if (body.evidence_update_max_messages != null) partial.evidence_update_max_messages = Number(body.evidence_update_max_messages)
    if (body.science_profile_ttl_minutes != null) partial.science_profile_ttl_minutes = Number(body.science_profile_ttl_minutes)
    if (body.science_generation_version != null) partial.science_generation_version = String(body.science_generation_version)

    const res = await setScienceConfig(partial)
    return NextResponse.json(res)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}

