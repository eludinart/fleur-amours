/**
 * POST /api/chat/mark_read
 * Body: { conversation_id, reader_role: 'user' | 'coach' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdminOrCoach, ApiError } from '@/lib/api-auth'
import { markChatConversationRead } from '@/lib/db-chat'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      conversation_id?: string | number
      reader_role?: string
    }
    const rawId = body.conversation_id
    const conversationId = typeof rawId === 'string' ? parseInt(rawId, 10) : Number(rawId)
    const readerRole = body.reader_role === 'coach' ? 'coach' : 'user'

    if (!Number.isFinite(conversationId) || conversationId < 1) {
      return NextResponse.json({ error: 'conversation_id invalide' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ ok: true })
    }

    if (readerRole === 'coach') {
      const { userId, isAdmin, isCoach } = await requireAdminOrCoach(req)
      const uid = parseInt(userId, 10)
      const { ok } = await markChatConversationRead({
        conversationId,
        readerRole: 'coach',
        readerUserId: uid,
        isAdmin,
        isCoach,
      })
      if (!ok) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      return NextResponse.json({ ok: true })
    }

    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const { ok } = await markChatConversationRead({
      conversationId,
      readerRole: 'user',
      readerUserId: uid,
    })
    if (!ok) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as ApiError & { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
