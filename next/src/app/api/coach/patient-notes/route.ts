/**
 * PATCH /api/coach/patient-notes
 * Notes coach par patient (hors cache IA), fusion partielle par clés.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdminOrCoach } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { mergeCoachPatientNotes, type CoachPatientNoteSection } from '@/lib/db-coach-patient-fiches'
import { listCoachPatientEmailsNormalized } from '@/lib/db-coach-patients'

export const dynamic = 'force-dynamic'

const SECTIONS: CoachPatientNoteSection[] = ['ensemble', 'fleur', 'ombres', 'patient_tab', 'sessions_tab']

export async function PATCH(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'DB non configurée' }, { status: 500 })
    }
    const { userId, isAdmin } = await requireAdminOrCoach(req)
    const viewerId = parseInt(userId, 10)
    if (!Number.isFinite(viewerId) || viewerId <= 0) {
      return NextResponse.json({ error: 'Utilisateur invalide' }, { status: 400 })
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const patientEmail = String(body?.patient_email ?? body?.patientEmail ?? '').trim().toLowerCase()
    if (!patientEmail) {
      return NextResponse.json({ error: 'patient_email requis' }, { status: 400 })
    }

    if (!isAdmin) {
      const allowed = await listCoachPatientEmailsNormalized(viewerId)
      if (!allowed.includes(patientEmail)) {
        return NextResponse.json({ error: 'Accès interdit (patient non lié à ce coach)' }, { status: 403 })
      }
    }

    const notesIn = body?.notes
    if (!notesIn || typeof notesIn !== 'object' || Array.isArray(notesIn)) {
      return NextResponse.json({ error: 'notes (objet) requis' }, { status: 400 })
    }

    const partial: Partial<Record<CoachPatientNoteSection, string>> = {}
    for (const k of SECTIONS) {
      if (!Object.prototype.hasOwnProperty.call(notesIn, k)) continue
      const v = (notesIn as Record<string, unknown>)[k]
      if (v === null || v === undefined) partial[k] = ''
      else if (typeof v === 'string') partial[k] = v
    }
    if (Object.keys(partial).length === 0) {
      return NextResponse.json({ error: 'aucune clé de notes reconnue' }, { status: 400 })
    }

    const coach_patient_notes = await mergeCoachPatientNotes({
      coachUserId: viewerId,
      patientEmail,
      partial,
    })

    return NextResponse.json({ ok: true, coach_patient_notes })
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'Erreur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
