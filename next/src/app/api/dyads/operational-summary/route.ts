/**
 * GET  /api/dyads/operational-summary — dernier résumé + historique
 * POST /api/dyads/operational-summary — génère si nouvel état, sinon renvoie l'existant
 *   body optionnel: { locale, force?: boolean } — force=true crée une nouvelle entrée même si signature identique
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import {
  appendDyadSummary,
  buildDyadSummaryContext,
  dyadSummarySignature,
  dyadSummaryStateMatches,
  getDyadSummaryBySignature,
  listDyadSummaryHistory,
  type DyadOperationalSummary,
  type DyadSummaryRecord,
} from '@/lib/db-dyad-summary'
import {
  getDyadMemberProfiles,
  getMyDyad,
  listDyadEvents,
  listRituals,
  userInDyad,
} from '@/lib/db-dyads'
import { llmCallForTask, getLlmMetaForTask, isLlmConfigured } from '@/lib/llm'
import { getLangInstruction } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

const CACHE_VERSION = 'ops-v2-hist'

function resolveLocale(req: NextRequest, bodyLocale?: string): string {
  const header = req.headers.get('x-locale') || req.headers.get('X-Locale')
  return String(bodyLocale ?? header ?? 'fr')
    .toLowerCase()
    .slice(0, 5)
}

function pickField(obj: Record<string, unknown>, keys: string[], max = 280): string {
  for (const k of keys) {
    const v = obj[k]
    if (v != null && String(v).trim() !== '') return String(v).trim().slice(0, max)
  }
  return ''
}

function normalizeAiSummary(
  result: Record<string, unknown> | null,
  fb: DyadOperationalSummary
): DyadOperationalSummary {
  if (!result || typeof result !== 'object') return fb
  const nested =
    result.summary && typeof result.summary === 'object' && !Array.isArray(result.summary)
      ? (result.summary as Record<string, unknown>)
      : result
  const headline = pickField(nested, ['headline', 'titre', 'title'])
  if (!headline) return fb
  return {
    headline,
    climate: pickField(nested, ['climate', 'climat', 'climate_actuel']) || fb.climate,
    alignments: pickField(nested, ['alignments', 'alignements', 'ressources']) || fb.alignments,
    gaps: pickField(nested, ['gaps', 'ecarts', 'écarts', 'vigilance']) || fb.gaps,
    nextStep: pickField(nested, ['nextStep', 'next_step', 'prochaine_etape', 'next']) || fb.nextStep,
  }
}

function fallbackSummary(locale: string): DyadOperationalSummary {
  const en = locale.startsWith('en')
  const es = locale.startsWith('es')
  if (en) {
    return {
      headline: 'Your shared garden is taking shape',
      climate: 'The duo space is active; keep nurturing small rituals together.',
      alignments: 'Your individual profiles feed the duo flower — observe what resonates.',
      gaps: 'Some petals may differ: treat gaps as invitations, not faults.',
      nextStep: 'Pick one ritual or one honest check-in conversation this week.',
    }
  }
  if (es) {
    return {
      headline: 'Vuestro jardín compartido se está formando',
      climate: 'El espacio duo está activo; cuiden pequeños rituales juntos.',
      alignments: 'Vuestros perfiles individuales alimentan la flor de duo.',
      gaps: 'Algunos pétalos pueden diferir: tratad los huecos como invitaciones.',
      nextStep: 'Elijan un ritual o una conversación honesta esta semana.',
    }
  }
  return {
    headline: 'Votre jardin commun prend forme',
    climate: 'L’espace duo est actif ; continuez à nourrir de petits rituels à deux.',
    alignments: 'Vos profils individuels nourrissent la fleur de duo — observez ce qui résonne.',
    gaps: 'Certains pétales peuvent diverger : voyez les écarts comme des invitations, pas des fautes.',
    nextStep: 'Choisissez un rituel ou un check-in honnête à deux cette semaine.',
  }
}

function toDto(record: DyadSummaryRecord) {
  return {
    id: record.id,
    signature: record.signature,
    summary: record.summary,
    provider: record.provider,
    createdAt: record.createdAt,
  }
}

async function loadDyadContext(uid: number) {
  const dyad = await getMyDyad(uid)
  if (!dyad || dyad.status !== 'active' || dyad.userB == null || !userInDyad(dyad, uid)) {
    return null
  }
  const [events, rituals, members] = await Promise.all([
    listDyadEvents(dyad.id, 30),
    listRituals(dyad.id),
    getDyadMemberProfiles(dyad.userA, dyad.userB),
  ])
  const signature = `${dyadSummarySignature({
    dyad,
    events,
    rituals,
    memberA: members.memberA,
    memberB: members.memberB,
  })}:${CACHE_VERSION}`
  return { dyad, events, rituals, members, signature }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const locale = resolveLocale(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ latest: null, history: [], currentSignature: null })
    }
    const ctx = await loadDyadContext(uid)
    if (!ctx) {
      return NextResponse.json({ latest: null, history: [], currentSignature: null })
    }

    const history = await listDyadSummaryHistory(ctx.dyad.id, locale, 40)
    const latest = history[0] ?? null
    return NextResponse.json({
      latest: latest ? toDto(latest) : null,
      history: history.map(toDto),
      currentSignature: ctx.signature,
      matchesCurrentState: latest
        ? dyadSummaryStateMatches(latest.signature, ctx.signature)
        : false,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message, latest: null, history: [] },
      { status: e.status || 401 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json().catch(() => ({}))) as { locale?: string; force?: boolean }
    const locale = resolveLocale(req, body.locale)
    const force = body.force === true

    if (!isDbConfigured()) {
      const fb = fallbackSummary(locale)
      return NextResponse.json({ summary: fb, record: null, cached: false, history: [] })
    }

    const ctx = await loadDyadContext(uid)
    if (!ctx) {
      return NextResponse.json({ error: 'Aucune dyade active' }, { status: 404 })
    }

    if (!force) {
      const existing = await getDyadSummaryBySignature(ctx.dyad.id, locale, ctx.signature)
      if (existing) {
        const history = await listDyadSummaryHistory(ctx.dyad.id, locale, 40)
        return NextResponse.json({
          summary: existing.summary,
          record: toDto(existing),
          cached: true,
          history: history.map(toDto),
        })
      }
    }

    const condensed = buildDyadSummaryContext({
      dyad: ctx.dyad,
      members: ctx.members,
      events: ctx.events,
      rituals: ctx.rituals,
    })

    const system =
      'Tu es un coach relationnel pragmatique pour un duo dans l’app Fleur d’AmOurs. À partir des données (fleurs individuelles, fleur de duo, rituels, fil partagé), produis un RÉSUMÉ OPÉRATIONNEL : concret, bienveillant, jamais clinique ni accusateur. Réponds UNIQUEMENT en JSON avec les clés : headline (vue d’ensemble, 1 phrase), climate (climat actuel du lien), alignments (ressources / points d’accord observables), gaps (écarts ou zones de vigilance sans jugement), nextStep (un geste concret à deux cette semaine). Chaque champ < 280 caractères.' +
      getLangInstruction(locale)

    const result = await llmCallForTask('dyad-summary', 
      system,
      [{ role: 'user', content: condensed }],
      { responseFormatJson: true, maxTokens: 700 }
    )

    const fb = fallbackSummary(locale)
    const summary = normalizeAiSummary(
      result && typeof result === 'object' ? (result as Record<string, unknown>) : null,
      fb
    )

    let recordId: number | null = null
    let persistError: string | null = null
    try {
      const inserted = await appendDyadSummary({
        dyadId: ctx.dyad.id,
        locale,
        signature: ctx.signature,
        summary,
        provider: (await getLlmMetaForTask('dyad-summary')).provider,
      })
      recordId = inserted.id
    } catch (persistErr: unknown) {
      const pe = persistErr as { message?: string; code?: string }
      persistError = pe.message || 'Échec enregistrement'
      console.error('[dyads/operational-summary POST] persist', pe.message ?? persistErr, pe.code)
    }

    const history = await listDyadSummaryHistory(ctx.dyad.id, locale, 40)
    const record =
      (recordId != null ? history.find((h) => h.id === recordId) : null) ?? history[0]

    return NextResponse.json({
      summary,
      record: record ? toDto(record) : null,
      cached: false,
      history: history.map(toDto),
      ...(persistError ? { persistWarning: persistError } : {}),
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string }
    console.error('[dyads/operational-summary POST]', e.message ?? err, e.code)
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500
    return NextResponse.json(
      { error: e.message || 'Erreur lors de la génération du résumé' },
      { status }
    )
  }
}
