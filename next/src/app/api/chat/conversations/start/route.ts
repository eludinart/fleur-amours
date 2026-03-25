/**
 * POST /api/chat/conversations/start
 * Crée ou récupère la conversation. Body: { coach_id?: number } (optionnel).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { startConversation } from '@/lib/db-chat'
import { authMe } from '@/lib/db-auth'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) {
      return NextResponse.json({ error: 'user_id invalide' }, { status: 400 })
    }

    let userEmail = ''
    if (isDbConfigured()) {
      try {
        const user = await authMe(uid)
        userEmail = user.email ?? ''
      } catch {
        /* ignore */
      }
    }

    let coachId: number | null | undefined = undefined
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      const hasKey =
        Object.prototype.hasOwnProperty.call(body, 'coach_id') ||
        Object.prototype.hasOwnProperty.call(body, 'coachId')
      if (hasKey) {
        const cid = body.coach_id ?? body.coachId
        if (cid == null || cid === '') {
          coachId = null
        } else {
          const n = parseInt(String(cid), 10)
          coachId = isNaN(n) || n <= 0 ? null : n
        }
      }
    } catch {
      /* ignore */
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ id: '0' }, { status: 201 })
    }

    const { id, status, closed_by_role } = await startConversation(uid, userEmail, coachId)
    return NextResponse.json(
      { id: String(id), status, closed_by_role: closed_by_role ?? null },
      { status: 201 }
    )
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 })
  }
}
