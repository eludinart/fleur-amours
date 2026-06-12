/**
 * POST /api/billing/create-checkout-session
 * Crée une session Stripe Checkout pour achat/abonnement.
 *
 * Sécurité : le client n'envoie qu'un `product_id` connu du catalogue serveur
 * (`billing-catalog.ts`). Le price Stripe, le mode et les unités SAP sont
 * résolus côté serveur — un `price_id` client est ignoré. Les URLs de retour
 * sont ré-ancrées sur le domaine de l'app (anti open-redirect).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthHeader, requireAuth } from '@/lib/api-auth'
import { jwtDecode } from '@/lib/jwt'
import { resolveBillingProduct, safeReturnUrl } from '@/lib/billing-catalog'
import { createCheckoutSession, getStripeSecretKey } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

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
    const productId = String(body.product_id ?? '').trim()
    if (!productId) {
      return NextResponse.json({ error: 'product_id requis' }, { status: 422 })
    }

    const product = resolveBillingProduct(productId)
    if (!product) {
      return NextResponse.json(
        { error: `Produit inconnu ou non configuré : ${productId}` },
        { status: 422 }
      )
    }

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_PUBLIC_URL || ''
    const base = appUrl || (typeof req.nextUrl !== 'undefined' ? `${req.nextUrl.origin}${basePath}` : '')
    if (!base) {
      return NextResponse.json(
        { error: 'URL publique non configurée (APP_PUBLIC_URL)' },
        { status: 503 }
      )
    }
    const successUrl = safeReturnUrl(base, body.success_url, '/account?checkout=success')
    const cancelUrl = safeReturnUrl(base, body.cancel_url, '/account?checkout=canceled')

    const token = getAuthHeader(req)
    const payload = token ? jwtDecode(token) : null
    const customerEmail = payload?.email?.trim() || undefined

    const metadata: Record<string, string> = {
      user_id: userId,
      ...(product.mode === 'subscription'
        ? { plan_id: product.planId ?? product.productId }
        : {
            product_id: product.productId,
            ...(product.sapUnits > 0 ? { sap_units: String(product.sapUnits) } : {}),
          }),
    }

    const result = await createCheckoutSession({
      priceId: product.priceId,
      mode: product.mode,
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
