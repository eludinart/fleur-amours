/**
 * POST /api/ai/extract_door_summary
 * Synthèse mi-parcours d'une porte (transition) — JSON pour DoorSummaryPanel.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { openrouterCall } from '@/lib/openrouter'
import { getLangInstruction } from '@/lib/prompts'
import { appendManuelReferenceToSystem } from '@/lib/manuel-ai-corpus'

export const dynamic = 'force-dynamic'

const DOOR_LABELS: Record<string, string> = {
  love: 'la Porte du Cœur',
  vegetal: 'la Porte du Temps',
  elements: 'la Porte du Climat',
  life: "la Porte de l'Histoire",
}

function getLocale(req: NextRequest): string {
  return req.headers.get('x-locale') || 'fr'
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function normalizePreview(raw: Record<string, unknown> | null): {
  synthesis_suggestion: string
  intention_emerged: string
  choices_emerged: string
  paths_solutions: string
  shadows_noted: string
} {
  if (!raw) {
    return {
      synthesis_suggestion: '',
      intention_emerged: '',
      choices_emerged: '',
      paths_solutions: '',
      shadows_noted: '',
    }
  }
  return {
    synthesis_suggestion: str(raw.synthesis_suggestion ?? raw.synthesis ?? ''),
    intention_emerged: str(raw.intention_emerged),
    choices_emerged: str(raw.choices_emerged),
    paths_solutions: str(raw.paths_solutions),
    shadows_noted: str(raw.shadows_noted),
  }
}

function hasAnyText(p: ReturnType<typeof normalizePreview>): boolean {
  return Object.values(p).some((x) => x.length > 0)
}

function buildFallback(
  history: Array<{ role?: string; content?: string }>,
  doorSubtitle: string
): ReturnType<typeof normalizePreview> {
  const lastUser = [...history].reverse().find((m) => (m.role ?? '') === 'user' && str(m.content))
  const lastAssistant = [...history].reverse().find((m) => (m.role ?? '') === 'assistant' && str(m.content))
  const quote = lastUser?.content?.trim() || lastAssistant?.content?.trim() || ''
  const short =
    quote.length > 600 ? `${quote.slice(0, 600)}…` : quote
  return {
    synthesis_suggestion: short
      ? `À ${doorSubtitle}, fils de l’échange : ${short}`
      : `Résumé indisponible pour l’instant — à ${doorSubtitle}, vous pouvez valider pour poursuivre ou continuer les échanges.`,
    intention_emerged: '',
    choices_emerged: '',
    paths_solutions: '',
    shadows_noted: '',
  }
}

const SYSTEM = `Tu es le Tuteur maïeutique du Jardin Fleur d'AmOurs. Tu rédiges un résumé mi-parcours du dialogue à UNE porte (échanges utilisateur et Tuteur sur le tarot Fleur d'AmOurs).

Règles :
- Fidélité au vécu et aux mots de la personne, sans jargon clinique.
- Pas de conseils prescriptifs (« vous devez », « il faut ») ; formulations invitantes.
- Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans texte autour), avec exactement ces clés :
{
  "synthesis_suggestion": "string — 2 à 5 phrases : ce qui a émergé, le mouvement intérieur, les pétales ou thèmes relationnels tangibles.",
  "intention_emerged": "string — intention ou besoin profond perçu (1–2 phrases), ou chaîne vide",
  "choices_emerged": "string — choix, gestes ou attitudes concrètes évoqués par la personne (1 phrase), ou vide",
  "paths_solutions": "string — tensions fécondes ou ouvertures de continuation (1–2 phrases), ou vide",
  "shadows_noted": "string — partie d'ombre ou difficulté nommée si pertinent ; sinon chaîne vide"
}

Si une dimension ne ressort pas, mets "" pour cette clé.`

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }

  let body: {
    history?: Array<{ role?: string; content?: string }>
    door_subtitle?: string
    door_key?: string
  }
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 422 })
  }

  const history = Array.isArray(body.history) ? body.history : []
  const doorSubtitle = String(body.door_subtitle ?? 'cette Porte').trim() || 'cette Porte'
  const doorKey = String(body.door_key ?? '').trim()
  const doorName = DOOR_LABELS[doorKey] || doorSubtitle
  const locale = getLocale(req)

  const oaiMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const m of history) {
    const role = (m.role ?? 'user') as 'user' | 'assistant'
    const content = String(m.content ?? '').trim()
    if (content) oaiMessages.push({ role: role === 'assistant' ? 'assistant' : 'user', content })
  }

  const userContent =
    `═══ RÉSUMÉ POUR LA PORTE ═══\n` +
    `Porte : ${doorName}\n\n` +
    `Synthétise le dialogue suivant (ordre chronologique).\n` +
    getLangInstruction(locale)

  const messages = [...oaiMessages, { role: 'user' as const, content: userContent }]

  if (process.env.OPENROUTER_API_KEY?.trim()) {
    const tail = oaiMessages
      .slice(-8)
      .map((m) => m.content)
      .join('\n')
    const doorSystem = appendManuelReferenceToSystem(SYSTEM, {
      retrievalQuery: `${doorName} ${tail}`.slice(0, 4_000),
      maxChars: 10_000,
    })
    const result = await openrouterCall(doorSystem, messages, {
      maxTokens: 1200,
      responseFormatJson: true,
    })

    if (result && typeof result === 'object') {
      const preview = normalizePreview(result as Record<string, unknown>)
      if (hasAnyText(preview)) {
        return NextResponse.json({ ...preview, provider: 'openrouter' })
      }
    }
  }

  const fallback = buildFallback(history, doorName)
  return NextResponse.json({ ...fallback, provider: 'fallback' })
}
