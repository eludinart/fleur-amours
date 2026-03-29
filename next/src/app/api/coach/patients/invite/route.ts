/**
 * POST /api/coach/patients/invite
 * Crée un token d'invitation (email + cadre) pour une future/actuelle patiente.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrCoach } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { createCoachInvitation } from '@/lib/db-coach-patients'
import { absolutePublicAppUrl } from '@/lib/app-public-url'
import { INTENTIONS } from '@/api/social'

export const dynamic = 'force-dynamic'

function isAllowedIntentionId(id: string): boolean {
  const normalized = String(id ?? '').trim()
  return INTENTIONS.some((i) => i.id === normalized)
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAdminOrCoach(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ ok: false, error: 'Backend non configuré' }, { status: 503 })
    }

    const body = (await req.json().catch(() => ({}))) as { email?: string; intention_id?: string; intentionId?: string }
    const email = String(body.email ?? '').trim()
    const intentionId = String(body.intention_id ?? body.intentionId ?? '').trim()

    if (!email) return NextResponse.json({ error: 'email requis' }, { status: 400 })
    if (!intentionId || !isAllowedIntentionId(intentionId)) {
      return NextResponse.json({ error: 'intention_id invalide' }, { status: 400 })
    }

    const { token } = await createCoachInvitation({
      coachUserId: Number(userId),
      inviteEmail: email,
      intentionId,
    })

    const invitePath = `/login?from=/&invite_token=${encodeURIComponent(token)}`
    const inviteLink = absolutePublicAppUrl(invitePath, req)

    return NextResponse.json({ ok: true, token, inviteLink })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status || 400 })
  }
}

