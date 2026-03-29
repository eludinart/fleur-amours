/**
 * POST /api/fleur-beta/interpretation
 * Synthèse IA (cache en base sur fleur_beta_results.ai_interpretation_json).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { getFleurBetaResult, saveFleurBetaInterpretation } from '@/lib/db-fleur-beta'
import { FLEUR_BETA_QUESTION_BANK } from '@/lib/fleur-beta-data'
import { openrouterCall } from '@/lib/openrouter'
import { getLangInstruction } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

const Q_BY_ID = new Map(FLEUR_BETA_QUESTION_BANK.map((q) => [q.id, q]))

function safeLocale(s: string | undefined): 'fr' | 'en' | 'es' {
  const l = String(s ?? 'fr').toLowerCase()
  if (l === 'en' || l === 'es' || l === 'fr') return l
  return 'fr'
}

function answersToContext(
  answers: unknown[],
  porte: string
): { dominantLine: string; qaBlock: string } {
  const lines: string[] = []
  const scoreHints: Record<string, number> = {}
  for (const raw of answers) {
    const a = raw as { questionId?: string; value?: number }
    const q = a?.questionId ? Q_BY_ID.get(String(a.questionId)) : undefined
    if (!q) continue
    const v = Number(a?.value ?? 0)
    for (const { id, weight } of q.petals) {
      scoreHints[id] = (scoreHints[id] ?? 0) + v * weight
    }
    lines.push(`- [${q.id}] ${q.text} → réponse (échelle 0–1): ${v}`)
  }
  const sorted = Object.entries(scoreHints).sort((x, y) => y[1] - x[1])
  const dominantLine =
    sorted.length > 0 ? `Pétales les plus nourries par les réponses brutes (indicatif): ${sorted.slice(0, 3).map(([k]) => k).join(', ')}` : ''
  return {
    dominantLine,
    qaBlock: [`Porte d'entrée (clé): ${porte}`, '', 'Parcours réponse par réponse:', ...lines].join('\n'),
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      result_id?: number
      locale?: string
      force?: boolean | string | number
    }
    const resultId = Number(body?.result_id)
    if (!resultId) {
      return NextResponse.json({ error: 'result_id requis' }, { status: 400 })
    }

    const locale = safeLocale(body?.locale)
    const uid = parseInt(userId, 10)
    const row = await getFleurBetaResult(resultId, userId)
    if (!row) {
      return NextResponse.json({ error: 'Résultat introuvable' }, { status: 404 })
    }

    const force =
      body.force === true ||
      body.force === 1 ||
      (typeof body.force === 'string' && body.force.toLowerCase() === 'true')
    const cached = row.interpretation as { summary?: string; insights?: string; reflection?: string } | null
    if (!force && (cached?.summary || cached?.insights || cached?.reflection)) {
      return NextResponse.json({
        summary: cached.summary ?? '',
        insights: cached.insights ?? '',
        reflection: cached.reflection ?? '',
        cached: true,
      })
    }

    const scores = row.scores as Record<string, number>
    const answers = Array.isArray(row.answers) ? row.answers : []
    const porte = String(row.porte ?? '')
    const { qaBlock, dominantLine } = answersToContext(answers, porte)

    const scoreLines = Object.entries(scores)
      .map(([k, v]) => `${k}: ${Math.round(Number(v) * 100)}%`)
      .join(', ')

    const system = `Tu es une voix d'accompagnement pour le cadre symbolique « Fleur d'AmOurs » (8 dimensions inspirées des formes d'amour grecs, exprimées comme pétales).
L'utilisateur vient de terminer un questionnaire BÊTA court (12 questions archétypales, entrée par une des 4 Portes du jardin).

Tu ne diagnostiques pas, tu ne pathologises pas. Tu proposes une lecture qualitative fine, ancrée dans les réponses et les scores normalisés.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, avec exactement ces clés :
{
  "summary": "string — 2 à 4 paragraphes courts : synthèse globale du motif relationnel qui se dessine, les couleurs dominantes et ce qui les équilibre.",
  "insights": "string — 1 à 2 paragraphes : tensions créatives, paradoxes productifs, ou zones où l'énergie se concentre (sans jugement).",
  "reflection": "string — un seul paragraphe : une ouverture douce (question ou invitation intérieure), non directive."
}

Contraintes de style : précision poétique et respectueuse ; éviter les clichés ; ne pas répéter mot pour mot les définitions académiques des pétales ; éviter les impératifs culpabilisants.`

    const userContent = `Scores par pétale (${scoreLines})
${dominantLine ? `\n${dominantLine}\n` : ''}
${qaBlock}
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

    await saveFleurBetaInterpretation(resultId, uid, {
      summary,
      insights,
      reflection,
      provider: 'openrouter',
    })

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
