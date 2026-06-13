/**
 * POST /api/mycelium/synthesis — synthèse IA QVT pour le dashboard RH (cache MariaDB).
 */
import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireMyceliumRh } from '@/lib/mycelium-auth'
import { isDbConfigured } from '@/lib/db'
import { getClimateDashboard } from '@/lib/db-aggregates'
import { countMembers, listTeams } from '@/lib/db-organisations'
import { getCachedSynthesis, getOrgAdoptionStats, saveSynthesisCache } from '@/lib/db-mycelium'
import { buildDimensionAlerts, petalLabel, PETAL_IDS_ORDER } from '@/lib/mycelium-lexicon'
import { openrouterCall } from '@/lib/openrouter'
import { getLangInstruction } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

const SYNTH_VERSION = 'v1'

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireMyceliumRh(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    if (!ctx.org) {
      return NextResponse.json({
        synthesis: {
          summary:
            'Aucune organisation configurée. Commencez par créer votre organisation dans Administration Mycelium, puis invitez vos membres.',
          actions: [
            'Créer une organisation dans Administration',
            'Inviter des membres par email',
            'Lancer une campagne Pulse de la semaine',
          ],
          cached_at: new Date().toISOString(),
          provider: 'setup',
        },
        cached: false,
      })
    }
    const org = ctx.org

    const body = (await req.json().catch(() => ({}))) as {
      teamId?: number
      windowDays?: number
      force?: boolean
      locale?: string
    }
    const teamId = body.teamId ?? null
    const windowDays = Math.min(Math.max(body.windowDays ?? 30, 7), 90)
    const locale = body.locale?.slice(0, 5) || 'fr'

    const members = await countMembers(org.id)
    const [adoption, dashboard] = await Promise.all([
      getOrgAdoptionStats(org.id),
      getClimateDashboard({ orgId: org.id, teamId, windowDays, totalMembers: members }),
    ])
    const alerts = buildDimensionAlerts(dashboard.current.petalsAverage, dashboard.previous.petalsAverage)

    const payload = {
      v: SYNTH_VERSION,
      org: org.name,
      windowDays,
      teamId,
      adoption,
      climate: dashboard.current,
      moodDelta: dashboard.moodDelta,
      alerts: alerts.map((a) => ({ label: a.label, delta: a.delta })),
    }
    const signature = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32)

    if (!body.force) {
      const cached = await getCachedSynthesis({ orgId: org.id, teamId, windowDays, signature })
      if (cached) {
        return NextResponse.json({ synthesis: cached, cached: true })
      }
    }

    if (!process.env.OPENROUTER_API_KEY) {
      const fallback = buildFallbackSynthesis(org.name, dashboard, alerts, adoption)
      return NextResponse.json({ synthesis: fallback, cached: false, mock: true })
    }

    const dimsText = dashboard.current.petalsAverage
      ? PETAL_IDS_ORDER.map(
          (id) => `${petalLabel(id, 'B')}: ${Math.round((dashboard.current.petalsAverage![id] ?? 0) * 100)}%`
        ).join(', ')
      : 'données insuffisantes (seuil k-anonymat)'

    const system =
      'Tu es un conseiller QVT (qualité de vie au travail) pour les ressources humaines. ' +
      'Tu reçois des indicateurs agrégés et anonymisés — jamais de noms. ' +
      'Réponds UNIQUEMENT en JSON : {"summary":"...","actions":["...","...","..."]}. ' +
      'summary : 2-3 phrases, ton professionnel RH, sans jargon ésotérique. ' +
      'actions : 3 pistes concrètes et réalisables en entreprise (pas de diagnostic médical).' +
      getLangInstruction(locale)

    const userContent = JSON.stringify({
      organisation: org.name,
      periode_jours: windowDays,
      membres: members,
      participation_30j: `${adoption.participationRate}%`,
      humeur_moyenne: dashboard.current.moodAverage,
      tendance_humeur: dashboard.moodDelta,
      repondants: dashboard.current.respondents,
      dimensions: dimsText,
      alertes: alerts.map((a) => `${a.label} (${a.delta})`),
    })

    const result = await openrouterCall(system, [{ role: 'user', content: userContent }], {
      responseFormatJson: true,
      maxTokens: 700,
      timeoutMs: 25000,
    })

    let summary = ''
    let actions: string[] = []
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      const r = result as Record<string, unknown>
      summary = String(r.summary ?? '').slice(0, 1200)
      actions = Array.isArray(r.actions)
        ? r.actions.map((a) => String(a).slice(0, 280)).filter(Boolean).slice(0, 5)
        : []
    }
    if (!summary) {
      const fallback = buildFallbackSynthesis(org.name, dashboard, alerts, adoption)
      return NextResponse.json({ synthesis: fallback, cached: false })
    }

    const synthesis = {
      summary,
      actions,
      cached_at: new Date().toISOString(),
      provider: 'openrouter',
    }
    await saveSynthesisCache({ orgId: org.id, teamId, windowDays, signature, synthesis })
    return NextResponse.json({ synthesis, cached: false })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}

function buildFallbackSynthesis(
  orgName: string,
  dashboard: Awaited<ReturnType<typeof getClimateDashboard>>,
  alerts: ReturnType<typeof buildDimensionAlerts>,
  adoption: Awaited<ReturnType<typeof getOrgAdoptionStats>>
) {
  const mood = dashboard.current.moodAverage
  const summary =
    mood != null
      ? `Pour ${orgName}, l'humeur moyenne est de ${mood}/5 sur ${dashboard.current.windowDays} jours, avec ${adoption.participationRate}% de participation.`
      : `Les indicateurs de ${orgName} se construisent : encouragez les pulses bien-être pour atteindre le seuil d'agrégation.`
  const actions = alerts.length
    ? alerts.map((a) => a.hint)
    : [
        'Organiser un point d\'équipe sur la charge de travail.',
        'Renforcer les rituels de reconnaissance entre pairs.',
        'Proposer un pulse bien-être hebdomadaire régulier.',
      ]
  return {
    summary,
    actions: actions.slice(0, 3),
    cached_at: new Date().toISOString(),
    provider: 'fallback',
  }
}
