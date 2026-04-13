import { api } from '@/lib/api-client'

export type CoachPatientNotesPayload = {
  ensemble?: string
  fleur?: string
  ombres?: string
  patient_tab?: string
  sessions_tab?: string
  updated_at?: string
}

export const coachNotesApi = {
  patchPatient: async (body: {
    patient_email: string
    notes: Partial<Record<keyof CoachPatientNotesPayload, string>>
  }) => {
    const r = (await api.patch('/api/coach/patient-notes', body)) as {
      ok: boolean
      coach_patient_notes: CoachPatientNotesPayload
    }
    return r
  },
  patchSession: async (body: { session_id: number; note: string }) => {
    const r = (await api.patch('/api/coach/session-notes', body)) as {
      ok: boolean
      session_id: number
      coach_private_note: string | null
    }
    return r
  },
}
