import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { unreadCountForUser } from '@/lib/db-notifications'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const unread = uid ? await unreadCountForUser(uid) : 0
    return NextResponse.json({ unread, count: unread })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string }
    console.error('[notifications/unread_count]', e.code ?? '', e.message ?? err)
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

