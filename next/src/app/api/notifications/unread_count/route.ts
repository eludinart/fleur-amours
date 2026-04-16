import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { unreadCountForUser } from '@/lib/db-notifications'
import { cacheGet, cacheSet } from '@/lib/server-cache'

export const dynamic = 'force-dynamic'

const NOTIF_TTL_MS = 30_000
const DB_TIMEOUT_MS = 2_500

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('notifications_unread_timeout')), timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)

    const cacheKey = `notif_unread:${uid}`
    const cached = cacheGet<number>(cacheKey)
    if (cached !== undefined) return NextResponse.json({ unread: cached, count: cached })

    const unread = uid ? await withTimeout(unreadCountForUser(uid), DB_TIMEOUT_MS).catch(() => 0) : 0
    cacheSet(cacheKey, unread, NOTIF_TTL_MS)
    return NextResponse.json({ unread, count: unread })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string }
    console.error('[notifications/unread_count]', e.code ?? '', e.message ?? err)
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

