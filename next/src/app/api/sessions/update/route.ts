import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { update } from '@/lib/db-sessions'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = await req.json()
    const result = await update(body)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 400 }
    )
  }
}
