/**
 * POST /api/ai/dashboard-insight
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { generateScienceProfile } from '@/lib/science-generator'

export const dynamic = 'force-dynamic'

type ScienceInsightResponse = Awaited<ReturnType<typeof generateScienceProfile>>

function buildFallbackInsight(localeRaw: string, petals: Record<string, number>): ScienceInsightResponse {
  const locale = String(localeRaw ?? 'fr').toLowerCase()
  const ordered = Object.entries(petals)
    .map(([k, v]) => ({ key: k, value: Number(v) || 0 }))
    .sort((a, b) => b.value - a.value)
  const top = ordered[0]?.key

  const labels: Record<string, Record<string, string>> = {
    fr: {
      agape: 'Agapè',
      philautia: 'Philautia',
      mania: 'Mania',
      storge: 'Storgè',
      pragma: 'Pragma',
      philia: 'Philia',
      ludus: 'Ludus',
      eros: 'Éros',
    },
    en: {
      agape: 'Agape',
      philautia: 'Philautia',
      mania: 'Mania',
      storge: 'Storge',
      pragma: 'Pragma',
      philia: 'Philia',
      ludus: 'Ludus',
      eros: 'Eros',
    },
    es: {
      agape: 'Ágape',
      philautia: 'Filautia',
      mania: 'Manía',
      storge: 'Storgè',
      pragma: 'Pragma',
      philia: 'Filia',
      ludus: 'Ludus',
      eros: 'Eros',
    },
  }

  const dict = locale.startsWith('en') ? labels.en : locale.startsWith('es') ? labels.es : labels.fr
  const topLabel = top && dict[top] ? dict[top] : null

  const factText = topLabel
    ? locale.startsWith('en')
      ? `Your current pattern appears centered around ${topLabel}.`
      : locale.startsWith('es')
        ? `Tu patrón actual parece centrarse en ${topLabel}.`
        : `Votre motif actuel semble se centrer autour de ${topLabel}.`
    : locale.startsWith('en')
      ? 'A first insight will appear as soon as more signals are available.'
      : locale.startsWith('es')
        ? 'Un primer insight aparecerá en cuanto haya más señales disponibles.'
        : 'Un premier aperçu apparaîtra dès que davantage de signaux seront disponibles.'

  return {
    facts: [
      {
        id: 'fact_fallback',
        text: factText,
        confidence: 0.35,
        confidence_label: 'low',
        perimeter: 'fallback',
        evidence_refs: [],
        can_be_hidden: false,
      },
    ],
    hypotheses: [
      {
        id: 'hyp_fallback',
        text: locale.startsWith('en')
          ? 'This is a temporary fallback insight while deeper analysis is unavailable.'
          : locale.startsWith('es')
            ? 'Este es un insight provisional mientras el análisis profundo no está disponible.'
            : "Ceci est un aperçu provisoire pendant qu'une analyse plus profonde est indisponible.",
        confidence: 0.2,
        confidence_label: 'low',
        perimeter: 'fallback',
        evidence_refs: [],
        can_be_hidden: true,
      },
    ],
    meta: {
      config_version: 'fallback',
      evidence_sources: [],
      has_chat_context: false,
      evidence_item_count: 0,
      generation_version: 'fallback',
      power_phrase: locale.startsWith('en')
        ? 'A calm petal still speaks.'
        : locale.startsWith('es')
          ? 'Hasta un pétalo en calma habla.'
          : 'Même un pétale calme parle.',
    },
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    const body = (await req.json().catch(() => ({}))) as {
      petals?: Record<string, number>
      locale?: string
    }

    const petals = body.petals ?? {}
    const locale = (body.locale ?? 'fr').toLowerCase()

    const userIdNum = parseInt(userId, 10)
    if (!Number.isFinite(userIdNum) || userIdNum <= 0) {
      return NextResponse.json({ error: 'Identité utilisateur invalide' }, { status: 401 })
    }

    let result: ScienceInsightResponse
    try {
      const user = await authMe(userIdNum)
      result = await generateScienceProfile({
        userId: userIdNum,
        userEmail: user.email,
        locale,
        petals,
      })
    } catch (innerErr: unknown) {
      // Tolérance runtime: éviter un 5xx utilisateur pour une panne provider/DB transitoire.
      console.error('[api/dashboard-insight] fallback', {
        userId: userIdNum,
        traceId: req.headers.get('x-trace-id') ?? null,
        message: (innerErr as { message?: string })?.message ?? 'unknown',
      })
      result = buildFallbackInsight(locale, petals)
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Erreur non prévue' }, { status: e.status || 401 })
  }
}
