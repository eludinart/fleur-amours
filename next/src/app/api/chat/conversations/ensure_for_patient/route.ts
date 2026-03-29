/**
 * POST /api/chat/conversations/ensure_for_patient
 * Body: { email: string } — crée ou rattache la conversation pour ce patient (depuis suivi coach / admin).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrCoach } from '@/lib/api-auth'
import { ensureConversationForPatientByEmail } from '@/lib/db-chat'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId, isAdmin, isCoach } = await requireAdminOrCoach(req)
    const staffId = parseInt(userId, 10)
    if (!staffId) {
      return NextResponse.json({ error: 'Utilisateur invalide' }, { status: 400 })
    }

    const body = (await req.json().catch(() => ({}))) as { email?: string }
    const email = String(body.email ?? '').trim()
    if (!email) {
      return NextResponse.json({ error: 'email requis' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Base non configurée' }, { status: 503 })
    }

    const { id, created } = await ensureConversationForPatientByEmail({
      patientEmail: email,
      staffUserId: staffId,
      isAdmin,
      isCoach,
    })

    return NextResponse.json({ id: String(id), created })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    const msg = e?.message ?? 'Erreur'
    const status =
      msg.includes('Aucun compte') || msg.includes('Email invalide') ? 404 : e?.status ?? 500
    return NextResponse.json({ error: msg }, { status })
  }
}
