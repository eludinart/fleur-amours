import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { authMe } from '@/lib/db-auth'
import { update, getSessionEmail } from '@/lib/db-sessions'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const body = await req.json()
    const sessionId = parseInt(String(body.id ?? 0), 10)
    if (!sessionId) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }

    // Vérification d'ownership : la session doit appartenir à l'utilisateur authentifié.
    const user = await authMe(parseInt(userId, 10))
    const sessionEmail = await getSessionEmail(sessionId)
    if (!sessionEmail || sessionEmail !== user.email) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const result = await update(body)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 401 }
    )
  }
}
