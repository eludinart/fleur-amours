/**
 * POST /api/coach/patients/rebuild
 * Force le recalcul du profil "Science de la Fleur" pour un patient lié.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrCoach } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { assertCoachHasAcceptedPatient, getPatientFleurMoyennePetalsRecord } from '@/lib/db-coach-patients'
import { authMe } from '@/lib/db-auth'
import { generateScienceProfile } from '@/lib/science-generator'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAdminOrCoach(req)
    const coachUserId = Number(userId)

    if (!isDbConfigured()) {
      return NextResponse.json({ ok: true, facts: [], hypotheses: [], meta: {} }, { status: 200 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      patient_user_id?: number
      patientId?: number
      locale?: string
    }

    const patientUserId = Number(body.patient_user_id ?? body.patientId ?? 0)
    if (!Number.isFinite(patientUserId) || patientUserId <= 0) {
      return NextResponse.json({ error: 'patient_user_id requis' }, { status: 400 })
    }

    const locale = String(body.locale ?? 'fr').toLowerCase()

    // AuthZ: vérifier que ce patient appartient bien au coach.
    await assertCoachHasAcceptedPatient({ coachUserId, patientUserId })

    const patient = await authMe(patientUserId)
    const petalsData = await getPatientFleurMoyennePetalsRecord(patientUserId)

    const result = await generateScienceProfile({
      userId: patientUserId,
      userEmail: patient.email || '',
      locale,
      petals: petalsData.petalsRecord,
      force: true,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status || 400 })
  }
}

