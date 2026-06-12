/**
 * POST /api/prairie/remove-link
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { removePrairieLink } from '@/lib/db-prairie'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const fromUserId = parseInt(userId, 10)
    const body = await req.json().catch(() => ({}))
    const toUserId = parseInt(String(body.to_user_id ?? body.toUserId ?? 0), 10)
    if (!fromUserId || !toUserId) {
      return NextResponse.json({ error: 'to_user_id requis' }, { status: 400 })
    }
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const result = await removePrairieLink(fromUserId, toUserId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status || 400 })
  }
}
