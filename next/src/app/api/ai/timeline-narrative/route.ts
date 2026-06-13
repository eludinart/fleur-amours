/**
 * POST /api/ai/timeline-narrative
 * Narration IA de l'évolution relationnelle (Éclosion), avec cache en base
 * (règle jardin-ai-token-cache) : on ne rappelle le modèle que si l'état de la
 * timeline a changé depuis la dernière génération.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import {
  getUserTimeline,
  getCachedNarrative,
  setCachedNarrative,
  timelineSignature,
} from '@/lib/db-timeline'
import { syncUserTimeline } from '@/lib/db-timeline-sync'
import { authMe } from '@/lib/db-auth'
import { openrouterCall } from '@/lib/openrouter'
import { getOpenRouterModel } from '@/lib/openrouter-config'
import { getLangInstruction } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

/** Incrémenter si le prompt change (invalide les narrations en cache). */
const NARRATIVE_CACHE_VERSION = 'lang-v2'

function resolveLocale(req: NextRequest, bodyLocale?: string): string {
  const header = req.headers.get('x-locale') || req.headers.get('X-Locale')
  return String(bodyLocale ?? header ?? 'fr')
    .toLowerCase()
    .slice(0, 5)
}

type Narrative = {
  headline: string
  movement: string
  focus: string
  encouragement: string
}

function fallbackNarrative(locale: string, count: number): Narrative {
  const en = locale.startsWith('en')
  const es = locale.startsWith('es')
  if (count === 0) {
    return en
      ? { headline: 'Your journey begins', movement: 'No steps recorded yet.', focus: 'Start a session or draw a card.', encouragement: 'Every garden starts with a first seed.' }
      : es
        ? { headline: 'Tu camino empieza', movement: 'Aún no hay pasos registrados.', focus: 'Empieza una sesión o saca una carta.', encouragement: 'Todo jardín empieza con una semilla.' }
        : { headline: 'Votre chemin commence', movement: "Aucune étape enregistrée pour l'instant.", focus: 'Démarrez une session ou tirez une carte.', encouragement: 'Tout jardin commence par une graine.' }
  }
  return en
    ? { headline: 'Your movement so far', movement: `You have ${count} recorded steps.`, focus: 'Keep observing what shifts.', encouragement: 'Continuity makes clarity grow.' }
    : es
      ? { headline: 'Tu movimiento hasta ahora', movement: `Tienes ${count} pasos registrados.`, focus: 'Sigue observando lo que cambia.', encouragement: 'La continuidad hace crecer la claridad.' }
      : { headline: 'Votre mouvement jusqu’ici', movement: `Vous avez ${count} étapes enregistrées.`, focus: 'Continuez à observer ce qui bouge.', encouragement: 'La continuité fait grandir la clarté.' }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json().catch(() => ({}))) as { locale?: string }
    const locale = resolveLocale(req, body.locale)

    if (!isDbConfigured()) {
      return NextResponse.json({ narrative: fallbackNarrative(locale, 0), cached: false })
    }

    const user = await authMe(uid).catch(() => null)
    await syncUserTimeline(uid, user?.email ?? null)
    const events = await getUserTimeline(uid, 40)
    const signature = `${timelineSignature(events)}:${NARRATIVE_CACHE_VERSION}`

    // 1) Lire le cache avant tout appel modèle.
    const cached = await getCachedNarrative(uid, locale, signature)
    if (cached) {
      return NextResponse.json({ narrative: cached, cached: true })
    }

    // 2) Générer si nécessaire.
    if (events.length === 0) {
      const narrative = fallbackNarrative(locale, 0)
      return NextResponse.json({ narrative, cached: false })
    }

    const condensed = events
      .slice(0, 30)
      .map((e) => `${e.createdAt} | ${e.source} | ${e.title}${e.mood != null ? ` | mood:${e.mood}` : ''}`)
      .join('\n')

    const system =
      'Tu es un guide relationnel bienveillant. À partir de la liste chronologique des étapes d\'une personne (sessions, tirages, explorations Fleur, conversations intérieures, questionnaires, check-ins), résume son évolution. Réponds UNIQUEMENT en JSON avec les clés : headline, movement, focus, encouragement. Chaque champ < 240 caractères, ton soutenant, jamais clinique.' +
      getLangInstruction(locale)

    const result = await openrouterCall(
      system,
      [{ role: 'user', content: condensed }],
      { responseFormatJson: true, maxTokens: 600 }
    )

    let narrative: Narrative
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>
      narrative = {
        headline: String(r.headline ?? '').slice(0, 240) || fallbackNarrative(locale, events.length).headline,
        movement: String(r.movement ?? '').slice(0, 240),
        focus: String(r.focus ?? '').slice(0, 240),
        encouragement: String(r.encouragement ?? '').slice(0, 240),
      }
      // 3) Persister le résultat (cache).
      await setCachedNarrative(uid, locale, signature, narrative as unknown as Record<string, unknown>, getOpenRouterModel()).catch(() => {})
      return NextResponse.json({ narrative, cached: false })
    }

    narrative = fallbackNarrative(locale, events.length)
    return NextResponse.json({ narrative, cached: false })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: e.status || 401 })
  }
}
