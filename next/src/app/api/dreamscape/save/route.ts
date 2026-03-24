import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { save } from '@/lib/db-dreamscape'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const body = await req.json()
    const result = await save(userId, body)
    return NextResponse.json({ ...result, saved: true }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 401 }
    )
  }
}
