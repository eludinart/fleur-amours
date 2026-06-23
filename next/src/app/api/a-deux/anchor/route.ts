/**
 * POST /api/a-deux/anchor — crée un profil ancre (porte ou complet).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { createAnchorComplet, createAnchorPorte } from '@/lib/db-a-deux'
import { isFleurBetaDoorKey, type FleurBetaAnswerInput } from '@/lib/fleur-beta-data'
import { recordTimelineEvent } from '@/lib/db-timeline'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      questionnaire_type?: string
      porte?: string
      answers?: unknown[]
      label?: string
    }

    const qType = body.questionnaire_type === 'complet' ? 'complet' : 'porte'

    if (qType === 'complet') {
      const answers = Array.isArray(body.answers) ? body.answers : []
      const data = await createAnchorComplet({
        userId: uid,
        answers: answers.map((a) => {
          const row = a as Record<string, unknown>
          return {
            question_id: Number(row.question_id),
            dimension_chosen: String(row.dimension_chosen ?? ''),
            choice_label: row.choice_label ? String(row.choice_label) : undefined,
          }
        }),
        label: body.label,
      })
      void recordTimelineEvent({
        userId: uid,
        source: 'fleur',
        refId: data.id,
        title: 'Profil ancre — questionnaire complet',
      }).catch(() => {})
      return NextResponse.json({ id: data.id, scores: data.scores, questionnaire_type: 'complet' }, { status: 201 })
    }

    const porte = typeof body.porte === 'string' ? body.porte.trim() : ''
    if (!isFleurBetaDoorKey(porte)) {
      return NextResponse.json({ error: 'porte invalide' }, { status: 400 })
    }
    const answers = (Array.isArray(body.answers) ? body.answers : []) as FleurBetaAnswerInput[]
    const data = await createAnchorPorte({
      userId: uid,
      porte,
      answers: answers.map((a) => ({
        questionId: String((a as FleurBetaAnswerInput).questionId ?? ''),
        value: Number((a as FleurBetaAnswerInput).value),
      })),
      label: body.label,
    })
    void recordTimelineEvent({
      userId: uid,
      source: 'diagnostic',
      refId: data.id,
      title: `Profil ancre — Porte ${porte}`,
    }).catch(() => {})
    return NextResponse.json(
      { id: data.id, scores: data.scores, questionnaire_type: 'porte', porte },
      { status: 201 }
    )
  } catch (err: unknown) {
    const e = err as Error
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: 400 })
  }
}
