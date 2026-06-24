import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { createPasswordResetToken } from '@/lib/db-password-reset'
import { buildNotificationEmailHtml, sendTransactionalEmail } from '@/lib/email'
import { absolutePublicAppUrl } from '@/lib/app-public-url'
import { resolveEmailLocale } from '@/lib/user-locale'
import { tServer } from '@/lib/i18n-server'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * Demande de réinitialisation de mot de passe.
 * Réponse toujours générique pour éviter l'énumération de comptes.
 */
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit('forgot-password', clientIp(req), { limit: 5, windowMs: 60_000 })
    if (limited) return limited

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré (MARIADB_*)' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const email = String(body?.email || '').trim()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Adresse e-mail requise' }, { status: 400 })
    }

    const request = await createPasswordResetToken(email)
    if (request) {
      const locale = await resolveEmailLocale({ userId: request.userId })
      const resetUrl = absolutePublicAppUrl(
        `/reset-password?token=${encodeURIComponent(request.token)}`,
        req
      )
      const name = request.displayName?.trim()
      const greeting = name
        ? tServer(locale, 'email.passwordReset.greeting', { name })
        : tServer(locale, 'email.passwordReset.greetingGeneric')
      const emailBody =
        `${greeting}\n\n` +
        `${tServer(locale, 'email.passwordReset.body')}\n\n` +
        `${tServer(locale, 'email.passwordReset.expiry')}`

      const { html, text, inlineImages } = await buildNotificationEmailHtml({
        title: tServer(locale, 'email.passwordReset.title'),
        body: emailBody,
        actionUrl: resetUrl,
        actionLabel: tServer(locale, 'email.passwordReset.cta'),
        locale,
        showGarden: false,
      })

      await sendTransactionalEmail({
        to: request.email,
        subject: tServer(locale, 'email.passwordReset.subject'),
        html,
        text,
        userId: request.userId,
        skipPrefs: true,
        inlineImages,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch {
    // Réponse générique même en cas d'erreur interne (anti-énumération).
    return NextResponse.json({ ok: true })
  }
}
