/**
 * GET /api/chat/messages?conversation_id=...&since=...
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { ensureChatSchema, getMessages, staffKindForMessage } from '@/lib/db-chat'
import { batchUserIdsWithAdminAccess, authMe } from '@/lib/db-auth'
import { getPool, table } from '@/lib/db'
import type { RowDataPacket } from 'mysql2'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const convId = parseInt(req.nextUrl.searchParams.get('conversation_id') ?? '0', 10)
    const since = req.nextUrl.searchParams.get('since') ?? null

    if (!convId) {
      return NextResponse.json({ error: 'conversation_id requis', items: [] }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ items: [] })
    }

    await ensureChatSchema()
    const pool = getPool()
    const tConv = table('fleur_chat_conversations')
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id, assigned_coach_id, status, closed_by_role FROM ${tConv} WHERE id = ?`,
      [convId]
    )
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Conversation introuvable', items: [] }, { status: 404 })
    }
    const conv = rows[0]
    const uid = parseInt(userId, 10)
    const convUserId = Number(conv.user_id)
    const isUser = convUserId === uid

    let canAccess = isUser
    if (!canAccess) {
      try {
        const user = await authMe(uid)
        const role = user.app_role || user.wp_role || ''
        const isAdmin = role === 'admin' || role === 'administrator'
        const isCoach = role === 'coach'
        const assignedCoach = conv.assigned_coach_id != null ? Number(conv.assigned_coach_id) : null
        canAccess =
          isAdmin || (isCoach && (assignedCoach === uid || assignedCoach == null))
      } catch {
        /* deny */
      }
    }
    if (!canAccess) {
      return NextResponse.json({ error: 'Accès refusé', items: [] }, { status: 403 })
    }

    const messages = await getMessages(convId, since)
    const assignedCoachId =
      conv.assigned_coach_id != null && String(conv.assigned_coach_id).trim() !== ''
        ? Number(conv.assigned_coach_id)
        : null
    const coachSenderIds = [
      ...new Set(
        messages.filter((m) => m.sender_role !== 'user').map((m) => m.sender_id)
      ),
    ]
    const adminIds = await batchUserIdsWithAdminAccess(coachSenderIds)
    const items = messages.map((m) => ({
      id: String(m.id),
      conversation_id: String(convId),
      sender_id: m.sender_id,
      sender_role: m.sender_role,
      sender_display_name: m.sender_display_name,
      staff_kind: staffKindForMessage(m.sender_role, m.sender_id, assignedCoachId, adminIds),
      content: m.content,
      created_at: m.created_at,
    }))
    const closedBy =
      conv.closed_by_role != null && String(conv.closed_by_role).trim() !== ''
        ? String(conv.closed_by_role)
        : null
    return NextResponse.json({
      items,
      assigned_coach_id: assignedCoachId != null && !Number.isNaN(assignedCoachId) ? assignedCoachId : null,
      status: String(conv.status ?? 'open'),
      closed_by_role: closedBy,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, items: [] }, { status: e.status ?? 401 })
  }
}
