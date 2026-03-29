/**
 * POST /api/fleur-beta/submit
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { submitFleurBeta } from '@/lib/db-fleur-beta'
import { isFleurBetaDoorKey, type FleurBetaAnswerInput } from '@/lib/fleur-beta-data'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré (MARIADB_*)' }, { status: 503 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      porte?: string
      answers?: FleurBetaAnswerInput[]
      questionnaire_version?: string
    }

    const porte = typeof body.porte === 'string' ? body.porte.trim() : ''
    if (!isFleurBetaDoorKey(porte)) {
      return NextResponse.json({ error: 'porte invalide' }, { status: 400 })
    }

    const answers = Array.isArray(body.answers) ? body.answers : []
    const data = await submitFleurBeta({
      userId: parseInt(userId, 10),
      porte,
      answers: answers.map((a) => ({
        questionId: String(a?.questionId ?? ''),
        value: Number(a?.value),
      })),
      questionnaireVersion: typeof body.questionnaire_version === 'string' ? body.questionnaire_version : undefined,
    })

    return NextResponse.json(
      {
        id: data.id,
        result_id: data.id,
        scores: data.scores,
        questionnaire_version: body.questionnaire_version ?? '2-beta',
        type: 'fleur-beta',
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e.status ?? 500
    return NextResponse.json({ error: e.message ?? 'Erreur enregistrement' }, { status })
  }
}
