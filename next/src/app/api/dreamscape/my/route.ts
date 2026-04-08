import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { my } from '@/lib/db-dreamscape'
import { requireAuth } from '@/lib/api-auth'
import { cacheGet, cacheSet } from '@/lib/server-cache'

export const dynamic = 'force-dynamic'

const TTL_MS = 45_000

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)

    const cacheKey = `dreamscape_my:${userId}`
    const cached = cacheGet<object>(cacheKey)
    if (cached) return NextResponse.json(cached)

    const data = await my(userId)
    cacheSet(cacheKey, data, TTL_MS)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 401 }
    )
  }
}
