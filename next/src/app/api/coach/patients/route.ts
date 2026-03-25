/**
 * GET /api/coach/patients
 * Liste la patientèle acceptée pour le coach courant.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrCoach } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getCoachPatients } from '@/lib/db-coach-patients'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAdminOrCoach(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ patients: [] }, { status: 200 })
    }

    const data = await getCoachPatients(Number(userId))
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status || 401 })
  }
}

