/**
 * POST /api/billing/create-checkout-session
 * Crée une session Stripe Checkout pour achat/abonnement.
 * Création session Stripe Checkout.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { jwtDecode } from '@/lib/jwt'
import { createCheckoutSession, getStripeSecretKey } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

function getAuthHeader(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!getStripeSecretKey()) {
      return NextResponse.json(
        { error: 'Stripe non configuré' },
        { status: 503 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const priceId = String(body.price_id ?? '').trim()
    const productId = String(body.product_id ?? '').trim()
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_PUBLIC_URL || ''
    const base = appUrl || (typeof req.nextUrl !== 'undefined' ? `${req.nextUrl.origin}${basePath}` : '')
    const successUrl = String(body.success_url ?? `${base}/account?checkout=success`).trim()
    const cancelUrl = String(body.cancel_url ?? `${base}/account?checkout=canceled`).trim()

    if (!successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: 'success_url et cancel_url requis (ou définir APP_PUBLIC_URL)' },
        { status: 422 }
      )
    }
    if (!priceId) {
      return NextResponse.json({ error: 'price_id requis' }, { status: 422 })
    }

    const token = getAuthHeader(req)
    const payload = token ? jwtDecode(token) : null
    const customerEmail = payload?.email?.trim() || undefined

    const mode = ['monthly', 'yearly'].includes(productId) ? 'subscription' : 'payment'
    const metadata: Record<string, string> = {
      user_id: userId,
      ...(mode === 'subscription'
        ? { plan_id: productId || 'monthly' }
        : { product_id: productId || 'credits_100' }),
    }

    const result = await createCheckoutSession({
      priceId,
      mode,
      successUrl,
      cancelUrl,
      clientReferenceId: userId,
      customerEmail,
      metadata,
    })

    if (!result?.url) {
      return NextResponse.json(
        { error: 'Impossible de créer la session de paiement' },
        { status: 502 }
      )
    }

    return NextResponse.json({ url: result.url, session_id: result.id })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e.status ?? 401
    return NextResponse.json(
      { error: e.message || 'Erreur lors de la création de la session' },
      { status }
    )
  }
}
