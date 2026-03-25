/**
 * GET /api/chat/conversations/my
 * Conversations de l'utilisateur connecté.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getMyConversations } from '@/lib/db-chat'
import { authMe } from '@/lib/db-auth'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) {
      return NextResponse.json({ conversations: [] })
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

    if (!isDbConfigured()) {
      return NextResponse.json({ conversations: [] })
    }

    const list = await getMyConversations(uid, userEmail)
    const conversations = list.map((c) => ({
      id: String(c.id),
      status: c.status,
      assigned_coach_id: c.assigned_coach_id,
      closed_by_role: c.closed_by_role,
      last_message_at: c.last_message_at,
      created_at: c.created_at,
    }))
    return NextResponse.json({ conversations })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, conversations: [] }, { status: e.status ?? 401 })
  }
}
