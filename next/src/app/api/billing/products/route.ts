/**
 * GET /api/billing/products
 * Produits Stripe (abonnements, packs) — prix depuis Stripe ou fallback JSON.
 * Produits Stripe (abonnements, packs).
 */
import { NextResponse } from 'next/server'
import { fetchStripePrice, getStripeSecretKey } from '@/lib/stripe'
import billingProducts from '@/data/billing-products.json'

export const dynamic = 'force-dynamic'

const ENV_MAP: Record<string, string> = {
  STRIPE_PRICE_MONTHLY: process.env.STRIPE_PRICE_MONTHLY || '',
  STRIPE_PRICE_YEARLY: process.env.STRIPE_PRICE_YEARLY || '',
  STRIPE_PRICE_CREDITS_100: process.env.STRIPE_PRICE_CREDITS_100 || '',
}

type ProductItem = {
  id: string
  type: string
  price_id: string
  label: string
  plan_id?: string
  credits?: number
  amount_cents: number
  unit: string
}

export async function GET() {
  const products: ProductItem[] = []
  const hasStripe = !!getStripeSecretKey()

  type SubItem = { price_id_env: string; plan_id?: string; label?: string; amount_cents?: number; amount_monthly_cents?: number; unit?: string }
  const subs = (billingProducts as { subscriptions?: Record<string, SubItem> }).subscriptions ?? {}
  for (const [id, p] of Object.entries(subs)) {
    const priceId = ENV_MAP[p.price_id_env] ?? ''
    if (!priceId) continue

    let amount_cents = 0
    let unit = p.unit ?? 'mois'
    if (hasStripe && priceId.startsWith('price_')) {
      const stripePrice = await fetchStripePrice(priceId)
      if (stripePrice?.unit_amount) {
        amount_cents = stripePrice.unit_amount
        unit = stripePrice.recurring?.interval === 'year' ? 'an' : 'mois'
      }
    }
    if (amount_cents <= 0) {
      amount_cents = p.amount_cents ?? p.amount_monthly_cents ?? 0
      unit = p.unit ?? 'mois'
    }

    products.push({
      id,
      type: 'subscription',
      price_id: priceId,
      label: p.label ?? id,
      plan_id: p.plan_id ?? id,
      amount_cents,
      unit,
    })
  }

  type PackItem = { price_id_env: string; label?: string; credits?: number; amount_cents?: number; unit?: string }
  const packs = (billingProducts as { packs?: Record<string, PackItem> }).packs ?? {}
  for (const [id, p] of Object.entries(packs)) {
    const priceId = ENV_MAP[p.price_id_env] ?? ''
    if (!priceId) continue

    let amount_cents = 0
    let unit = p.unit ?? ''
    if (hasStripe && priceId.startsWith('price_')) {
      const stripePrice = await fetchStripePrice(priceId)
      if (stripePrice?.unit_amount) {
        amount_cents = stripePrice.unit_amount
        unit = ''
      }
    }
    if (amount_cents <= 0) {
      amount_cents = p.amount_cents ?? 0
      unit = p.unit ?? ''
    }

    products.push({
      id,
      type: 'pack',
      price_id: priceId,
      label: p.label ?? id,
      credits: p.credits ?? 0,
      amount_cents,
      unit,
    })
  }

  return NextResponse.json({ products })
}
