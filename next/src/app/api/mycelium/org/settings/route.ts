/**
 * PATCH /api/mycelium/org/settings — charte entreprise + campagne pulse.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireMyceliumRh } from '@/lib/mycelium-auth'
import { isDbConfigured } from '@/lib/db'
import { getOrganisation, updateOrgCharter, setPulseCampaign, type PulseCampaign } from '@/lib/db-organisations'
import { pulseQuestionForWeek } from '@/lib/db-mycelium'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireMyceliumRh(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    if (!ctx.org) {
      return NextResponse.json({ error: 'Créez d\'abord une organisation' }, { status: 403 })
    }
    const org = ctx.org
    const body = (await req.json().catch(() => ({}))) as {
      charter?: string | null
      launchPulseCampaign?: boolean
      pulseCampaign?: { title?: string; message?: string; question?: string; active?: boolean }
    }

    if (body.charter !== undefined) {
      await updateOrgCharter(org.id, body.charter ?? null)
    }

    if (body.launchPulseCampaign) {
      const campaign: PulseCampaign = {
        title: String(body.pulseCampaign?.title ?? 'Pulse de la semaine').slice(0, 200),
        message: String(
          body.pulseCampaign?.message ??
            'Prenez deux minutes pour partager comment vous vous sentez au travail cette semaine.'
        ).slice(0, 1000),
        question: String(body.pulseCampaign?.question ?? pulseQuestionForWeek()).slice(0, 400),
        startedAt: new Date().toISOString(),
        active: true,
      }
      await setPulseCampaign(org.id, campaign)
    } else if (body.pulseCampaign?.active === false) {
      await setPulseCampaign(org.id, null)
    }

    const updated = await getOrganisation(org.id)
    return NextResponse.json({ org: updated, saved: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
