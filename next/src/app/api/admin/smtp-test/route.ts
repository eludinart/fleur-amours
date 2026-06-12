/**
 * POST /api/admin/smtp-test — vérifie la configuration SMTP (admin).
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdmin } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { isSmtpConfigured, trySendSmtpMail } from '@/lib/smtp'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAdmin(req)
    if (!isSmtpConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'SMTP non configuré (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM)' },
        { status: 503 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as { to?: string }
    const me = await authMe(parseInt(userId, 10))
    const to = String(body.to ?? me.email ?? '').trim()
    if (!to) {
      return NextResponse.json({ error: 'Adresse destinataire requise' }, { status: 400 })
    }

    const result = await trySendSmtpMail({
      to,
      subject: "Test SMTP — Fleur d'AmOurs",
      text: 'Si vous recevez cet e-mail, la configuration SMTP fonctionne.',
      html: '<p>Si vous recevez cet e-mail, la configuration SMTP fonctionne.</p>',
    })

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 })
    }
    return NextResponse.json({ ok: true, messageId: result.messageId, to })
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const e = err as Error
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: 500 })
  }
}
