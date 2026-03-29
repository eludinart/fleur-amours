import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { authMe } from '@/lib/db-auth'
import { save } from '@/lib/db-sessions'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const user = await authMe(parseInt(userId, 10))
    const body = await req.json()

    // Lie la session à l'utilisateur authentifié, ignore tout email envoyé par le client.
    const result = await save({ ...body, email: user.email })
    return NextResponse.json({ ...result, saved: true }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 401 }
    )
  }
}
