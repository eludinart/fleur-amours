/**
 * POST /api/a-deux/pairing/invite-by-user-id — invitation À deux à un utilisateur inscrit en lien.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAuth, ApiError } from '@/lib/api-auth'
import { invitePairingByUserId } from '@/lib/db-a-deux'
import { authMe } from '@/lib/db-auth'
import { absolutePublicAppUrl } from '@/lib/app-public-url'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json().catch(() => ({}))) as {
      invite_token?: string
      to_user_id?: number
      app_base_url?: string
    }
    const inviteToken = String(body.invite_token ?? '').trim()
    const toUserId = Number(body.to_user_id ?? 0)
    if (!inviteToken || !toUserId) {
      return NextResponse.json({ detail: 'Token et utilisateur requis' }, { status: 400 })
    }

    const me = await authMe(uid).catch(() => null)
    const inviterName = me?.name?.trim() || me?.email || undefined
    const invitePath = `/a-deux/invitation?token=${encodeURIComponent(inviteToken)}`
    const inviteUrl = body.app_base_url
      ? `${String(body.app_base_url).replace(/\/+$/, '')}${invitePath}`
      : absolutePublicAppUrl(invitePath, req)

    const result = await invitePairingByUserId({
      inviteToken,
      fromUserId: uid,
      toUserId,
      inviteUrl,
      inviterName,
    })

    return NextResponse.json({
      sent: result.sent,
      notified: result.notified,
      email_sent: result.email_sent,
      ...(result.error && !result.sent ? { detail: result.error } : {}),
    })
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ detail: err.message }, { status: err.status })
    }
    const e = err as Error
    return NextResponse.json({ detail: e.message || 'Erreur' }, { status: 400 })
  }
}
