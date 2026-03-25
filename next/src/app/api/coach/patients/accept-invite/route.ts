/**
 * POST /api/coach/patients/accept-invite
 * Consomme une invitation (token) pour le user actuellement authentifié.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { consumeCoachInvitation } from '@/lib/db-coach-patients'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const body = (await req.json().catch(() => ({}))) as { invite_token?: string; inviteToken?: string }
    const inviteToken = String(body.invite_token ?? body.inviteToken ?? '').trim()
    if (!inviteToken) {
      return NextResponse.json({ error: 'invite_token requis' }, { status: 400 })
    }

    await consumeCoachInvitation({ inviteToken, acceptorUserId: Number(userId) })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status || 400 })
  }
}

