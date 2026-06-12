/**
 * GET /api/chat/unread
 * Nombre de messages staff non lus pour l'utilisateur connecté (badge sidebar).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { unreadCountForChatUser } from '@/lib/db-chat'
import { isDbConfigured } from '@/lib/db'
import { cacheGet, cacheSet } from '@/lib/server-cache'

export const dynamic = 'force-dynamic'

const TTL_MS = 20_000

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) return NextResponse.json({ count: 0 })
    const uid = parseInt(userId, 10)
    if (!Number.isFinite(uid) || uid < 1) return NextResponse.json({ count: 0 })

    const cacheKey = `chat_unread:${uid}`
    const cached = cacheGet<number>(cacheKey)
    if (cached !== undefined) return NextResponse.json({ count: cached })

    const count = await unreadCountForChatUser(uid).catch(() => 0)
    cacheSet(cacheKey, count, TTL_MS)
    return NextResponse.json({ count })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
