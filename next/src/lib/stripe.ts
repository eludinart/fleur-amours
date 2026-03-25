/**
 * Appels API Stripe (récupération prix, création session checkout).
 * Stripe : produits, checkout, webhooks.
 */
const STRIPE_API = 'https://api.stripe.com/v1'

export function getStripeSecretKey(): string {
  return (process.env.STRIPE_SECRET_KEY || '').trim()
}

async function stripeFetch(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, string>
): Promise<Record<string, unknown> | null> {
  const key = getStripeSecretKey()
  if (!key) return null

  const url = `${STRIPE_API}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
  }

  let res: Response
  if (method === 'GET') {
    res = await fetch(url, { method: 'GET', headers })
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    const formBody = body ? new URLSearchParams(body).toString() : ''
    res = await fetch(url, { method: 'POST', headers, body: formBody })
  }

  const data = await res.json().catch(() => null)
  if (!res.ok || !data || data.error) return null
  return data as Record<string, unknown>
}

/** Récupère un prix Stripe (unit_amount en centimes) */
export async function fetchStripePrice(priceId: string): Promise<{
  unit_amount: number
  recurring?: { interval: string }
} | null> {
  if (!priceId?.startsWith('price_')) return null
  const data = await stripeFetch('GET', `/prices/${priceId}`)
  if (!data || typeof (data as { unit_amount?: unknown }).unit_amount !== 'number') return null
  const price = data as { unit_amount: number; recurring?: { interval: string } }
  return {
    unit_amount: price.unit_amount,
    recurring: price.recurring,
  }
}

/** Crée une session Stripe Checkout */
export async function createCheckoutSession(params: {
  priceId: string
  mode: 'payment' | 'subscription'
  successUrl: string
  cancelUrl: string
  clientReferenceId: string
  customerEmail?: string
  metadata: Record<string, string>
}): Promise<{ url?: string; id?: string } | null> {
  const key = getStripeSecretKey()
  if (!key) return null

  const form: Record<string, string> = {
    mode: params.mode,
    'success_url': params.successUrl,
    'cancel_url': params.cancelUrl,
    'client_reference_id': params.clientReferenceId,
    'line_items[0][price]': params.priceId,
    'line_items[0][quantity]': '1',
    'payment_method_types[0]': 'card',
  }
  if (params.customerEmail) form['customer_email'] = params.customerEmail

  if (params.mode === 'subscription') {
    form['subscription_data[metadata][user_id]'] = params.metadata.user_id || ''
    form['subscription_data[metadata][plan_id]'] = params.metadata.plan_id || ''
  } else {
    form['payment_intent_data[metadata][user_id]'] = params.metadata.user_id || ''
    form['payment_intent_data[metadata][product_id]'] = params.metadata.product_id || ''
    for (const [k, v] of Object.entries(params.metadata)) {
      if (v == null || v === '') continue
      form[`payment_intent_data[metadata][${k}]`] = String(v)
    }
  }

  for (const [k, v] of Object.entries(params.metadata)) {
    if (v == null || v === '') continue
    form[`metadata[${k}]`] = String(v)
  }

  const data = await stripeFetch('POST', '/checkout/sessions', form)
  if (!data) return null
  return {
    url: (data as { url?: string }).url,
    id: (data as { id?: string }).id,
  }
}

/** Métadonnées PaymentIntent (remboursements webhook). */
export async function fetchPaymentIntentMetadata(
  paymentIntentId: string
): Promise<Record<string, string> | null> {
  if (!paymentIntentId?.startsWith('pi_')) return null
  const data = await stripeFetch('GET', `/payment_intents/${paymentIntentId}`)
  if (!data) return null
  const raw = (data as { metadata?: Record<string, unknown> }).metadata
  if (!raw || typeof raw !== 'object') return {}
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, String(v ?? '')])
  )
}

/** Montants en centimes pour prorata remboursement. */
export async function fetchChargeAmounts(chargeId: string): Promise<{
  amount: number
  amount_refunded: number
} | null> {
  if (!chargeId?.startsWith('ch_')) return null
  const data = await stripeFetch('GET', `/charges/${chargeId}`)
  if (!data) return null
  const amount = Number((data as { amount?: unknown }).amount)
  const amount_refunded = Number((data as { amount_refunded?: unknown }).amount_refunded)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return {
    amount,
    amount_refunded: Number.isFinite(amount_refunded) ? Math.max(0, amount_refunded) : 0,
  }
}
