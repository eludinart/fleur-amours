/**
 * POST /api/dyads/accept — accepte une invitation de couple par token.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { acceptDyadInvite } from '@/lib/db-dyads'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as { token?: string }
    const token = String(body.token ?? '').trim()
    if (!token) return NextResponse.json({ error: 'token requis' }, { status: 400 })
    const dyad = await acceptDyadInvite(token, parseInt(userId, 10))
    return NextResponse.json({ dyad })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 400 })
  }
}
