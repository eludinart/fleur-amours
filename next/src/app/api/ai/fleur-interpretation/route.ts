/**
 * POST /api/ai/fleur-interpretation
 * Interprétation personnalisée Fleur classique (24 questions) — synthèse IA, cache dans fleur_amour_results.ai_interpretation.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { getResult, saveFleurAmourInterpretation } from '@/lib/db-fleur'
import { openrouterCall } from '@/lib/openrouter'
import { getLangInstruction } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

const PETALS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const

function safeLocale(s: string | undefined): 'fr' | 'en' | 'es' {
  const l = String(s ?? 'fr').toLowerCase()
  if (l === 'en' || l === 'es' || l === 'fr') return l
  return 'fr'
}

function normalizeScores(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of PETALS) {
    const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[p] : undefined
    out[p] = Math.max(0, Number(v ?? 0))
  }
  return out
}

function hasAnyScore(scores: Record<string, number>): boolean {
  return Object.values(scores).some((v) => Number(v) > 0)
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!process.env.OPENROUTER_API_KEY?.trim()) {
      return NextResponse.json({ error: 'Interprétation IA non configurée (OPENROUTER_API_KEY)' }, { status: 503 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      scores?: Record<string, number>
      answers?: Array<{ dimension?: string; label?: string }>
      result_id?: number | string
      locale?: string
      force?: boolean | string | number
    }

    const locale = safeLocale(body?.locale)
    const uid = parseInt(userId, 10)
    const force =
      body.force === true ||
      body.force === 1 ||
      (typeof body.force === 'string' && body.force.toLowerCase() === 'true')

    const resultIdNum =
      body.result_id != null && body.result_id !== ''
        ? Number(body.result_id)
        : NaN
    const resultId = Number.isFinite(resultIdNum) && resultIdNum > 0 ? resultIdNum : 0

    let scores = normalizeScores(body?.scores)
    type InterpretationFields = { summary?: string; insights?: string; reflection?: string }
    let cached: InterpretationFields | null = null

    if (resultId > 0 && isDbConfigured()) {
      try {
        const row = await getResult(resultId, userId)
        cached = (row.interpretation as InterpretationFields | null) ?? null
        if (!hasAnyScore(scores) && row.scores && typeof row.scores === 'object') {
          scores = normalizeScores(row.scores)
        }
        if (
          !force &&
          cached &&
          (cached.summary || cached.insights || cached.reflection)
        ) {
          return NextResponse.json({
            summary: cached.summary ?? '',
            insights: cached.insights ?? '',
            reflection: cached.reflection ?? '',
            cached: true,
          })
        }
      } catch {
        return NextResponse.json({ error: 'Résultat introuvable ou accès refusé' }, { status: 404 })
      }
    }

    if (!hasAnyScore(scores)) {
      return NextResponse.json({ error: 'scores requis (ou result_id valide)' }, { status: 400 })
    }

    const answers = Array.isArray(body?.answers) ? body.answers : []
    const answerLines =
      answers.length > 0
        ? answers
            .map((a, i) => {
              const d = String(a?.dimension ?? '').trim()
              const lbl = String(a?.label ?? '').trim()
              return `${i + 1}. ${d || '?'} — « ${lbl || '…'} »`
            })
            .join('\n')
        : '(Aucun détail de réponses fourni — interpréter à partir des scores uniquement.)'

    const scoreLines = PETALS.map((p) => `${p}: ${scores[p]} (choix sur 24 questions)`).join(', ')
    const dominant = [...PETALS].sort((a, b) => scores[b] - scores[a]).slice(0, 3).join(', ')

    const system = `Tu es une voix d'accompagnement pour le cadre symbolique « Fleur d'AmOurs » : huit dimensions inspirées des formes d'amour grecs (pétales), issues d'un questionnaire de 24 questions à choix (chaque choix incrémente une dimension : les scores affichés sont des décomptes bruts, somme 24).

Tu ne diagnostiques pas, tu ne pathologises pas. Tu proposes une lecture qualitative fine, ancrée dans les scores et, si fourni, les libellés de réponses.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, avec exactement ces clés :
{
  "summary": "string — 2 à 4 paragraphes courts : synthèse globale du motif relationnel, ce qui domine et ce qui équilibre.",
  "insights": "string — 1 à 2 paragraphes : tensions créatives, paradoxes, zones d'énergie (sans jugement).",
  "reflection": "string — un seul paragraphe : ouverture douce (question ou invitation intérieure), non directive."
}

Style : précision poétique et respectueuse ; éviter les clichés ; ne pas réciter des définitions académiques des pétales ; pas d'impératifs culpabilisants.`

    const userContent = `Scores par pétale (0–3 comptés depuis le questionnaire) : ${scoreLines}
Pétales les plus marquées (indicatif) : ${dominant}

Réponses (extrait des choix) :
${answerLines}
${getLangInstruction(locale)}`

    const raw = await openrouterCall(
      system,
      [{ role: 'user', content: userContent }],
      { maxTokens: 1400, responseFormatJson: true }
    )

    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Interprétation indisponible (IA)' }, { status: 503 })
    }

    const out = raw as Record<string, unknown>
    const summary = typeof out.summary === 'string' ? out.summary.trim() : ''
    const insights = typeof out.insights === 'string' ? out.insights.trim() : ''
    const reflection = typeof out.reflection === 'string' ? out.reflection.trim() : ''

    if (!summary && !insights && !reflection) {
      return NextResponse.json({ error: 'Réponse IA vide' }, { status: 503 })
    }

    if (resultId > 0 && isDbConfigured()) {
      void saveFleurAmourInterpretation(resultId, uid, { summary, insights, reflection })
    }

    return NextResponse.json({
      summary,
      insights,
      reflection,
      cached: false,
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
