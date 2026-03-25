/**
 * POST /api/billing/stripe-webhook — crédit SAP (checkout) et retrait (remboursement).
 * STRIPE_WEBHOOK_SECRET + URL dans le dashboard Stripe.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyStripeWebhookSignature } from '@/lib/stripe-webhook'
import {
  claimStripeWebhookEvent,
  releaseStripeWebhookEvent,
} from '@/lib/db-stripe-webhook'
import {
  transactionalSapUpdate,
  SapError,
  sapPurchaseReasonExists,
  sapDebitUpTo,
} from '@/lib/db-sap'
import { fetchChargeAmounts, fetchPaymentIntentMetadata } from '@/lib/stripe'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

function parseSapUnitsFromMetadata(meta: Record<string, string>): number {
  const direct = parseInt(meta.sap_units ?? '', 10)
  if (Number.isFinite(direct) && direct > 0) return direct
  const pid = (meta.product_id ?? '').trim()
  const m = /^sap_(\d+)$/.exec(pid)
  if (m) {
    const n = parseInt(m[1], 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  return 0
}

function metaFromObject(metaRaw: unknown): Record<string, string> {
  if (!metaRaw || typeof metaRaw !== 'object' || Array.isArray(metaRaw)) return {}
  return Object.fromEntries(
    Object.entries(metaRaw as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
  )
}

async function handleCheckoutSessionCompleted(session: Record<string, unknown>): Promise<void> {
  const meta = metaFromObject(session.metadata)
  const userId = parseInt(meta.user_id ?? String(session.client_reference_id ?? ''), 10)
  const units = parseSapUnitsFromMetadata(meta)

  if (!userId || units <= 0) return

  const sid = String(session.id ?? '')
  const reason = `stripe_checkout:${sid}`
  if (await sapPurchaseReasonExists(reason)) return

  await transactionalSapUpdate(userId, units, reason, 'purchase')
}

async function handleChargeRefunded(charge: Record<string, unknown>, eventId: string): Promise<void> {
  const chargeId = String(charge.id ?? '')
  const piRaw = charge.payment_intent
  const piId = typeof piRaw === 'string' ? piRaw : String((piRaw as { id?: string })?.id ?? '')
  if (!chargeId.startsWith('ch_') || !piId.startsWith('pi_')) return

  const meta = (await fetchPaymentIntentMetadata(piId)) ?? {}
  const userId = parseInt(meta.user_id ?? '', 10)
  const sapUnits = parseSapUnitsFromMetadata(meta)
  if (!userId || sapUnits <= 0) return

  const amounts = await fetchChargeAmounts(chargeId)
  if (!amounts || amounts.amount_refunded <= 0) return

  const ratio = Math.min(1, amounts.amount_refunded / amounts.amount)
  const toRemove = Math.max(0, Math.floor(sapUnits * ratio))
  if (toRemove <= 0) return

  await sapDebitUpTo(userId, toRemove, `stripe_refund:${eventId}`)
}

export async function POST(req: NextRequest) {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim()
  if (!secret) {
    return NextResponse.json({ success: false, error: 'Webhook non configuré' }, { status: 503 })
  }

  const raw = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!verifyStripeWebhookSignature(raw, sig, secret)) {
    return NextResponse.json({ success: false, error: 'Signature invalide' }, { status: 400 })
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, error: 'Base de données non configurée' }, { status: 503 })
  }

  let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } }
  try {
    event = JSON.parse(raw) as typeof event
  } catch {
    return NextResponse.json({ success: false, error: 'JSON invalide' }, { status: 400 })
  }

  const eventId = String(event.id ?? '').trim()
  const eventType = String(event.type ?? '').trim()
  if (!eventId) {
    return NextResponse.json({ success: false, error: 'Événement sans id' }, { status: 400 })
  }

  const claimed = await claimStripeWebhookEvent(eventId, eventType)
  if (!claimed) {
    return NextResponse.json({ success: true, data: { received: true, duplicate: true } })
  }

  try {
    if (eventType === 'checkout.session.completed') {
      const session = event.data?.object
      if (session && typeof session === 'object') {
        await handleCheckoutSessionCompleted(session)
      }
    } else if (eventType === 'charge.refunded') {
      const charge = event.data?.object
      if (charge && typeof charge === 'object') {
        await handleChargeRefunded(charge, eventId)
      }
    }

    return NextResponse.json({
      success: true,
      data: { received: true, type: eventType },
    })
  } catch (e) {
    console.error('[stripe-webhook]', eventType, e)
    await releaseStripeWebhookEvent(eventId)
    if (e instanceof SapError) {
      return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
    return NextResponse.json({ success: false, error: 'Traitement webhook échoué' }, { status: 500 })
  }
}
