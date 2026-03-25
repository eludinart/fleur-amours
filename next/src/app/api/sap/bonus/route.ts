/**
 * POST /api/sap/bonus — crédit bonus manuel (admin ou coach pour un patient lié).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrCoach } from '@/lib/api-auth'
import { ApiError } from '@/lib/api-auth'
import { assertCoachHasAcceptedPatient } from '@/lib/db-coach-patients'
import { transactionalSapUpdate } from '@/lib/db-sap'
import {
  assertCoachBonusRateLimit,
  logSapBonus,
  BonusRateLimitError,
} from '@/lib/db-sap-bonus'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const patientUserId = parseInt(String(body.patient_user_id ?? body.user_id ?? ''), 10)
    const amount = parseInt(String(body.amount ?? ''), 10)
    const reason = String(body.reason ?? 'bonus_coach').trim() || 'bonus_coach'

    if (!patientUserId || amount < 1 || amount > 50_000) {
      return NextResponse.json(
        { success: false, error: 'patient_user_id et amount (1–50000) requis.' },
        { status: 422 }
      )
    }

    const auth = await requireAdminOrCoach(req)
    const actorId = parseInt(auth.userId, 10)
    if (!auth.isAdmin) {
      await assertCoachHasAcceptedPatient({
        coachUserId: actorId,
        patientUserId,
      })
    }

    await assertCoachBonusRateLimit(actorId, auth.isAdmin)

    const { balance } = await transactionalSapUpdate(patientUserId, amount, reason, 'bonus')
    try {
      await logSapBonus({
        actorUserId: actorId,
        patientUserId,
        amount,
        reason,
      })
    } catch (logErr) {
      console.error('[sap/bonus] audit log failed', logErr)
    }

    return NextResponse.json({
      success: true,
      data: { patient_user_id: patientUserId, credited: amount, balance },
    })
  } catch (err) {
    if (err instanceof BonusRateLimitError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 429 })
    }
    if (err instanceof ApiError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status })
    }
    const e = err as Error & { status?: number }
    const msg = e.message || 'Erreur bonus SAP'
    const status = e.status === 403 ? 403 : 500
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
