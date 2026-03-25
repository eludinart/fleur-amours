/**
 * GET /api/chat/stats
 * Stats pour le dashboard coach/admin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrCoach } from '@/lib/api-auth'
import { stats } from '@/lib/db-chat'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId, isAdmin, isCoach } = await requireAdminOrCoach(req)
    const coachUserId = parseInt(userId, 10)

    if (!isDbConfigured()) {
      return NextResponse.json({ total: 0, open: 0, unread_messages: 0 })
    }

    const data = await stats(isAdmin, isCoach, coachUserId)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message, total: 0, open: 0, unread_messages: 0 },
      { status: e.status ?? 401 }
    )
  }
}
