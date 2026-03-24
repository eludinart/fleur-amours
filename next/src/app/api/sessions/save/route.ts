import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { save } from '@/lib/db-sessions'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = await req.json()
    const result = await save(body)
    return NextResponse.json({ ...result, saved: true }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 400 }
    )
  }
}
