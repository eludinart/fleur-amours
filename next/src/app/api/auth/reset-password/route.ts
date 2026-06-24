import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { consumePasswordResetToken, MIN_PASSWORD_LENGTH } from '@/lib/db-password-reset'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/** Réinitialise le mot de passe à partir d'un token valide. */
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit('reset-password', clientIp(req), { limit: 10, windowMs: 60_000 })
    if (limited) return limited

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré (MARIADB_*)' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const token = String(body?.token || '').trim()
    const password = String(body?.password || '')
    if (!token) {
      return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 400 })
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères` },
        { status: 400 }
      )
    }

    const result = await consumePasswordResetToken(token, password)
    if (!result.ok) {
      if (result.reason === 'expired') {
        return NextResponse.json({ error: 'Ce lien a expiré. Veuillez refaire une demande.' }, { status: 400 })
      }
      if (result.reason === 'weak_password') {
        return NextResponse.json(
          { error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères` },
          { status: 400 }
        )
      }
      if (result.reason === 'db') {
        return NextResponse.json({ error: 'Service indisponible. Réessayez plus tard.' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Lien invalide ou déjà utilisé' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erreur lors de la réinitialisation' }, { status: 500 })
  }
}
