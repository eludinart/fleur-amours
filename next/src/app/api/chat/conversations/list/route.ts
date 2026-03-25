/**
 * GET /api/chat/conversations/list
 * Liste des conversations (coach/admin). Coach : seulement ses patients + non assignés.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrCoach } from '@/lib/api-auth'
import { listConversations } from '@/lib/db-chat'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId, isAdmin, isCoach } = await requireAdminOrCoach(req)
    const coachUserId = parseInt(userId, 10)

    const status = req.nextUrl.searchParams.get('status') ?? 'open'
    const perPage = parseInt(req.nextUrl.searchParams.get('per_page') ?? '50', 10)

    if (!isDbConfigured()) {
      return NextResponse.json({ items: [], total: 0 })
    }

    const { items, total } = await listConversations(coachUserId, isAdmin, isCoach, {
      status: status || undefined,
      per_page: perPage,
    })

    return NextResponse.json({ items, total })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, items: [], total: 0 }, { status: e.status ?? 401 })
  }
}
