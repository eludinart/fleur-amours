/**
 * POST /api/chat/mark_all_read
 * Initialise `coach_last_read_at` pour les conversations du coach/admin connecté,
 * uniquement lorsque `coach_last_read_at` est encore NULL.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrCoach } from '@/lib/api-auth'
import { markCoachConversationsRead } from '@/lib/db-chat'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await req.json().catch(() => ({}))
    if (!isDbConfigured()) return NextResponse.json({ ok: true, updated: 0 })

    const { userId, isAdmin, isCoach } = await requireAdminOrCoach(req)
    const uid = parseInt(userId, 10)
    if (!Number.isFinite(uid) || uid < 1) {
      return NextResponse.json({ error: 'userId invalide' }, { status: 400 })
    }

    const result = await markCoachConversationsRead({
      readerUserId: uid,
      isAdmin,
      isCoach,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e?.message ?? 'Erreur' }, { status: e?.status ?? 500 })
  }
}

