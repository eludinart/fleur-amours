/**
 * POST /api/a-deux/pairing/[token]/submit — partenaire B complète son questionnaire.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import {
  completePairing,
  createAnchorComplet,
  createAnchorPorte,
  getPairingByToken,
  notifyPairingCompleted,
} from '@/lib/db-a-deux'
import { isFleurBetaDoorKey, type FleurBetaAnswerInput } from '@/lib/fleur-beta-data'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const { token } = await params
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const pairingData = await getPairingByToken(token)
    if (!pairingData) return NextResponse.json({ error: 'Token introuvable' }, { status: 404 })
    if (pairingData.pairing.status === 'complete') {
      return NextResponse.json({ error: 'Ce duo est déjà complété' }, { status: 400 })
    }

    const anchorType = String(pairingData.anchor.questionnaire_type ?? 'porte')
    const lockedPorte = pairingData.anchor.porte ? String(pairingData.anchor.porte) : null
    const body = (await req.json().catch(() => ({}))) as {
      questionnaire_type?: string
      porte?: string
      answers?: unknown[]
    }

    let partnerAnchorId: number

    if (anchorType === 'complet' || body.questionnaire_type === 'complet') {
      const answers = Array.isArray(body.answers) ? body.answers : []
      const created = await createAnchorComplet({
        userId: uid,
        answers: answers.map((a) => {
          const row = a as Record<string, unknown>
          return {
            question_id: Number(row.question_id),
            dimension_chosen: String(row.dimension_chosen ?? ''),
            choice_label: row.choice_label ? String(row.choice_label) : undefined,
          }
        }),
      })
      partnerAnchorId = created.id
    } else {
      const porte = lockedPorte ?? (typeof body.porte === 'string' ? body.porte.trim() : '')
      if (!isFleurBetaDoorKey(porte)) {
        return NextResponse.json({ error: 'porte invalide' }, { status: 400 })
      }
      if (lockedPorte && porte !== lockedPorte) {
        return NextResponse.json({ error: 'La Porte doit correspondre à celle de la personne A' }, { status: 400 })
      }
      const answers = (Array.isArray(body.answers) ? body.answers : []) as FleurBetaAnswerInput[]
      const created = await createAnchorPorte({
        userId: uid,
        porte,
        answers: answers.map((a) => ({
          questionId: String(a.questionId ?? ''),
          value: Number(a.value),
        })),
      })
      partnerAnchorId = created.id
    }

    await completePairing({
      inviteToken: token,
      partnerUserId: uid,
      partnerAnchorId,
    })
    void notifyPairingCompleted(token, uid)

    return NextResponse.json({ ok: true, partner_anchor_id: partnerAnchorId }, { status: 201 })
  } catch (err: unknown) {
    const e = err as Error
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: 400 })
  }
}
