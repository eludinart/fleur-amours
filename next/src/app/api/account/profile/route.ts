import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { authMe, updateProfile } from '@/lib/db-auth'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const user = await authMe(parseInt(userId, 10))
    return NextResponse.json(user)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Non autorisé' },
      { status: e.status || 401 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const body = await req.json()
    const user = await updateProfile(parseInt(userId, 10), body)
    return NextResponse.json(user)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 400 }
    )
  }
}
