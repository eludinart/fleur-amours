import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { submitCoachRequest } from '@/lib/db-coach-request'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (Number.isNaN(uid)) {
      return NextResponse.json({ error: 'Utilisateur invalide' }, { status: 400 })
    }
    const me = await authMe(uid)
    const role = me.app_role || me.wp_role || ''
    if (role === 'coach' || role === 'admin' || role === 'administrator') {
      return NextResponse.json({ error: 'Vous avez déjà un accès accompagnant.' }, { status: 400 })
    }
    const body = await req.json().catch(() => ({}))
    const message = typeof body.message === 'string' ? body.message : ''
    await submitCoachRequest(uid, message)
    const user = await authMe(uid)
    return NextResponse.json({ ok: true, user })
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const e = err as Error & { code?: string }
    if (e.code === 'COACH_REQUEST_ALREADY_PENDING') {
      return NextResponse.json({ error: 'Une demande est déjà en cours.' }, { status: 409 })
    }
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: 400 })
  }
}
