/**
 * POST /api/promo/redeem — Échange un code promo contre des SAP.
 *
 * Body : { code: string }
 * Auth : requireAuth (l'utilisateur doit être connecté)
 *
 * La transaction SQL garantit :
 *   1. Le code existe, est actif, non expiré, pas encore épuisé.
 *   2. L'utilisateur ne l'a pas déjà utilisé (unicité code_id + user_id).
 *   3. Les SAP sont ajoutés sur le Sablier (fleur_users_access) + miroir wallet.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiError } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { redeemPromoCode, PromoError } from '@/lib/db-promo'
import { transactionalSapUpdate } from '@/lib/db-sap'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) {
      return NextResponse.json({ error: 'Utilisateur invalide.' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré.' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!code) {
      return NextResponse.json({ error: 'Champ `code` requis.' }, { status: 400 })
    }

    // Vérifier + consommer le code (transaction interne dans redeemPromoCode)
    const { sapCredited } = await redeemPromoCode(code, uid)

    await transactionalSapUpdate(uid, sapCredited, `promo:${code.toUpperCase()}`, 'bonus')

    return NextResponse.json({
      success: true,
      sap_credited: sapCredited,
      message: `${sapCredited} SAP ajoutés à votre portefeuille.`,
    })
  } catch (err) {
    if (err instanceof PromoError) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        INACTIVE: 410,
        EXPIRED: 410,
        MAX_USES_REACHED: 410,
        ALREADY_USED: 409,
      }
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: statusMap[err.code] ?? 400 }
      )
    }
    if (err instanceof ApiError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status })
    }
    console.error('[promo/redeem]', err)
    return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 })
  }
}
