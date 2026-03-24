import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getShared } from '@/lib/db-dreamscape'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const token = req.nextUrl.searchParams.get('token')?.trim()
    if (!token) {
      return NextResponse.json({ error: 'Token requis' }, { status: 400 })
    }
    const data = await getShared(token)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Partage introuvable' },
      { status: e.status || 404 }
    )
  }
}
