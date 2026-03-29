/**
 * GET /api/fleur-beta/questions?porte=love|vegetal|elements|life
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  FLEUR_BETA_CHOICE_VALUES,
  isFleurBetaDoorKey,
  orderQuestionsForPorte,
} from '@/lib/fleur-beta-data'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const porteRaw = req.nextUrl.searchParams.get('porte') || 'love'
  if (!isFleurBetaDoorKey(porteRaw)) {
    return NextResponse.json(
      { error: 'porte invalide (love | vegetal | elements | life)' },
      { status: 400 }
    )
  }
  const ordered = orderQuestionsForPorte(porteRaw)
  const questions = ordered.map((q) => ({
    id: q.id,
    porte: q.porte,
    text: q.text,
    petals: q.petals,
    choiceValues: [...FLEUR_BETA_CHOICE_VALUES],
  }))
  return NextResponse.json({
    porte: porteRaw,
    questionnaire_version: '2-beta',
    questions,
  })
}
