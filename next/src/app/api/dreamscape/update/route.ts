import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { update } from '@/lib/db-dreamscape'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const body = await req.json()
    const id = parseInt(String(body.id ?? 0), 10)
    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }
    await update(userId, id, body)
    return NextResponse.json({ id, saved: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 401 }
    )
  }
}
