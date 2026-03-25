import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { authRegister } from '@/lib/db-auth'
import { jwtEncode } from '@/lib/jwt'
import { consumeCoachInvitation } from '@/lib/db-coach-patients'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Backend non configuré (MARIADB_*)' },
        { status: 503 }
      )
    }
    const body = await req.json()
    const email = (body.email || '').trim()
    const password = body.password || ''
    const name = (body.name || body.display_name || '').trim()
    const inviteToken = String(body.invite_token ?? body.inviteToken ?? '').trim()
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }
    const user = await authRegister(email, password, name)

    // MVP: si le user arrive via un lien d'invitation, on consomme le token et on crée
    // immédiatement la relation coach -> user (seed acceptée + canal Clairière).
    if (inviteToken) {
      try {
        await consumeCoachInvitation({ inviteToken, acceptorUserId: Number(user.id) })
      } catch {
        // best-effort: l'inscription ne doit pas échouer si l'invitation est invalide.
      }
    }

    const token = jwtEncode({
      sub: String(user.id),
      role: user.app_role || 'user',
      email: user.email || '',
    })
    return NextResponse.json({ token, user })
  } catch (err: unknown) {
    const e = err as Error
    const status = (e as Error & { status?: number }).status || 400
    return NextResponse.json(
      { error: e.message || 'Erreur lors de l\'inscription' },
      { status }
    )
  }
}
