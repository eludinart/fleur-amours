/**
 * GET /api/social/clairiere_unread_count
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getClairiereUnreadCount } from '@/lib/db-social'
import { cacheGet, cacheSet } from '@/lib/server-cache'

export const dynamic = 'force-dynamic'

const CLAIRIERE_TTL_MS = 30_000

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!userId) return NextResponse.json({ count: 0 })
    if (!isDbConfigured()) return NextResponse.json({ count: 0 })

    const cacheKey = `clairiere_unread:${userId}`
    const cached = cacheGet<number>(cacheKey)
    if (cached !== undefined) return NextResponse.json({ count: cached })

    const count = await getClairiereUnreadCount(userId)
    cacheSet(cacheKey, count, CLAIRIERE_TTL_MS)
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
