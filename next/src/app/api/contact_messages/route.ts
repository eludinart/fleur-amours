/**
 * POST /api/contact_messages — formulaire de contact (auth optionnelle).
 * GET  /api/contact_messages — liste admin/coach.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, getUserIdFromRequest, requireAdminOrCoach } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { createContactMessage, listContactMessages } from '@/lib/db-contact'
import { sendAdminAlertEmail, sendContactConfirmationEmail, buildNotificationEmailHtml } from '@/lib/email'

export const dynamic = 'force-dynamic'

const REQUEST_TYPE_LABELS: Record<string, string> = {
  rdv: 'Demande de rendez-vous personnalisé',
  question: 'Question sur l\'accompagnement',
  other: 'Autre',
}

const PREFERENCE_LABELS: Record<string, string> = {
  videoconference: 'Visioconférence',
  phone: 'Téléphone',
  both: 'Visio ou téléphone',
}

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    if (body.gdprAccepted !== true) {
      return NextResponse.json({ error: 'Consentement requis' }, { status: 400 })
    }

    const email = String(body.email ?? '').trim()
    const name = body.name != null ? String(body.name).trim() : ''
    const requestType = String(body.requestType ?? 'rdv')
    const preference = String(body.preference ?? 'both')
    const userMessage = String(body.message ?? '').trim()
    if (!email || !userMessage) {
      return NextResponse.json({ error: 'Email et message requis' }, { status: 400 })
    }

    const subject = REQUEST_TYPE_LABELS[requestType] ?? REQUEST_TYPE_LABELS.rdv
    const prefLabel = PREFERENCE_LABELS[preference] ?? preference
    const fullMessage = [
      userMessage,
      '',
      `— Type : ${subject}`,
      `— Préférence : ${prefLabel}`,
    ].join('\n')

    const userIdRaw = getUserIdFromRequest(req)
    const userId = userIdRaw ? parseInt(userIdRaw, 10) : null
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null

    const { id } = await createContactMessage({
      userId: userId && !Number.isNaN(userId) ? userId : null,
      email,
      name: name || null,
      subject,
      message: fullMessage,
      ipAddress: ip,
    })

    const { html, text } = buildNotificationEmailHtml({
      title: `Nouvelle demande de contact #${id}`,
      body: `De : ${name || '—'} <${email}>\n\n${fullMessage}`,
    })
    void sendAdminAlertEmail({
      subject: `[Contact] ${subject} — ${name || email}`,
      html,
      text,
      roles: ['admin', 'coach'],
    }).catch(() => {})

    void sendContactConfirmationEmail({ to: email, name: name || null }).catch(() => {})

    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (err: unknown) {
    const e = err as Error
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: 400 })
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminOrCoach(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ items: [], total: 0, pages: 1 })
    }
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const perPage = parseInt(searchParams.get('per_page') ?? '20', 10)
    const status = searchParams.get('status') ?? ''
    const data = await listContactMessages({ page, per_page: perPage, status })
    return NextResponse.json(data)
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const e = err as Error
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: 500 })
  }
}
