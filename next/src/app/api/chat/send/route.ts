/**
 * POST /api/chat/send
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { notifyCoachChatNewMessage, sendMessage, staffKindForMessage } from '@/lib/db-chat'
import { getPool, table } from '@/lib/db'
import { authMe, batchUserIdsWithAdminAccess } from '@/lib/db-auth'
import type { RowDataPacket } from 'mysql2'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const convId = parseInt(String(body.conversation_id ?? body.conversationId ?? '0'), 10)
    const content = String(body.content ?? '').trim() || '(message vide)'
    const senderRole = (body.sender_role ?? 'user') === 'coach' ? 'coach' : 'user'

    if (!convId) {
      return NextResponse.json({ error: 'conversation_id requis' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json(
        {
          id: `stub-${Date.now()}`,
          conversation_id: String(convId),
          sender_id: uid,
          sender_role: senderRole,
          sender_display_name: null as string | null,
          staff_kind: senderRole === 'user' ? 'user' : 'assigned_coach',
          content,
          created_at: new Date().toISOString(),
        },
        { status: 201 }
      )
    }

    const pool = getPool()
    const tConv = table('fleur_chat_conversations')
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id, assigned_coach_id FROM ${tConv} WHERE id = ?`,
      [convId]
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 })
    }
    const conv = rows[0]
    const convUserId = Number(conv.user_id)
    const isUser = convUserId === uid

    if (senderRole === 'user') {
      if (!isUser) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    } else {
      let canAccess = false
      try {
        const user = await authMe(uid)
        const role = user.app_role || user.wp_role || ''
        const isAdmin = role === 'admin' || role === 'administrator'
        const isCoach = role === 'coach'
        const assignedCoach = conv.assigned_coach_id != null ? Number(conv.assigned_coach_id) : null
        canAccess = isAdmin || (isCoach && (assignedCoach === uid || assignedCoach == null))
      } catch {
        /* deny */
      }
      if (!canAccess) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const msg = await sendMessage(convId, uid, senderRole, content)
    void notifyCoachChatNewMessage(convId, senderRole, uid, content)

    const [convAfter] = await pool.execute<RowDataPacket[]>(
      `SELECT assigned_coach_id FROM ${tConv} WHERE id = ?`,
      [convId]
    )
    const assignedAfter =
      convAfter[0]?.assigned_coach_id != null && String(convAfter[0].assigned_coach_id).trim() !== ''
        ? Number(convAfter[0].assigned_coach_id)
        : null
    const adminSet =
      senderRole === 'coach'
        ? await batchUserIdsWithAdminAccess([uid])
        : new Set<number>()
    const staff_kind =
      senderRole === 'user'
        ? 'user'
        : staffKindForMessage(msg.sender_role, msg.sender_id, assignedAfter, adminSet)

    return NextResponse.json(
      {
        id: String(msg.id),
        conversation_id: String(msg.conversation_id),
        sender_id: msg.sender_id,
        sender_role: msg.sender_role,
        sender_display_name: msg.sender_display_name,
        staff_kind,
        content: msg.content,
        created_at: msg.created_at,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500
    return NextResponse.json({ error: e.message }, { status })
  }
}
