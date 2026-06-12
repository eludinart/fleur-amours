/**
 * GET  /api/mycelium/seats — sièges et usage de l'organisation gérée.
 * POST /api/mycelium/seats — billing B2B par sièges (au-dessus du Stripe existant).
 *   - { seats } et Stripe configuré (STRIPE_PRICE_SEATS_B2B) → checkout abonnement
 *     avec quantité = sièges (facturation centralisée par poste).
 *   - sinon → fixe directement la capacité (mode hors-paiement / admin).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { isDbConfigured } from '@/lib/db'
import { absolutePublicAppUrl } from '@/lib/app-public-url'
import { countMembers, getManagedOrg, getSeats, setSeats } from '@/lib/db-organisations'
import { createCheckoutSession, getStripeSecretKey } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) return NextResponse.json({ seats: 0, members: 0 })
    const managed = await getManagedOrg(parseInt(userId, 10))
    if (!managed) return NextResponse.json({ error: 'Aucune organisation gérée' }, { status: 403 })
    const [seats, members] = await Promise.all([getSeats(managed.org.id), countMembers(managed.org.id)])
    return NextResponse.json({ seats: seats.seats, members, stripe: !!seats.stripeSubscriptionId })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const managed = await getManagedOrg(uid)
    if (!managed) return NextResponse.json({ error: 'Aucune organisation gérée' }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as { seats?: number }
    const seats = Math.max(1, parseInt(String(body.seats ?? 0), 10) || 0)
    if (seats <= 0) return NextResponse.json({ error: 'Nombre de sièges invalide' }, { status: 400 })

    const priceId = process.env.STRIPE_PRICE_SEATS_B2B || ''
    const stripeReady = !!getStripeSecretKey() && priceId.startsWith('price_')

    if (stripeReady) {
      let email: string | undefined
      try {
        const user = await authMe(uid)
        email = user.email || undefined
      } catch {
        /* ignore */
      }
      const session = await createCheckoutSession({
        priceId,
        mode: 'subscription',
        quantity: seats,
        successUrl: absolutePublicAppUrl('/mycelium/admin?seats=ok', req),
        cancelUrl: absolutePublicAppUrl('/mycelium/admin?seats=cancel', req),
        clientReferenceId: `org_${managed.org.id}`,
        customerEmail: email,
        metadata: { user_id: String(uid), org_id: String(managed.org.id), seats: String(seats), plan_id: 'seats_b2b' },
      })
      if (session?.url) {
        // Les sièges ne sont accordés qu'au webhook checkout.session.completed.
        return NextResponse.json({ checkoutUrl: session.url })
      }
      return NextResponse.json(
        { error: 'Impossible de créer la session de paiement' },
        { status: 502 }
      )
    }

    // Sans Stripe : autorisé hors production uniquement (tests / staging).
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Paiement requis : Stripe non configuré pour les sièges B2B' },
        { status: 503 }
      )
    }
    await setSeats(managed.org.id, seats)
    return NextResponse.json({ seats })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
