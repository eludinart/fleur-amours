/**
 * Catalogue billing côté serveur — source de vérité unique pour le checkout.
 * Le client n'envoie qu'un `product_id` ; le price Stripe, le mode et les
 * métadonnées (SAP, plan) sont résolus ici. Jamais de price_id client.
 */
import billingProducts from '@/data/billing-products.json'

export type ResolvedProduct = {
  productId: string
  priceId: string
  mode: 'payment' | 'subscription'
  sapUnits: number
  planId: string | null
}

function envPrice(envKey: string): string {
  return (process.env[envKey] || '').trim()
}

/** Résout un produit du catalogue ; null si inconnu ou prix non configuré. */
export function resolveBillingProduct(productId: string): ResolvedProduct | null {
  const id = String(productId || '').trim()
  if (!id) return null

  const subs = (billingProducts as {
    subscriptions?: Record<string, { price_id_env: string; plan_id?: string }>
  }).subscriptions ?? {}
  const sub = subs[id]
  if (sub) {
    const priceId = envPrice(sub.price_id_env)
    if (!priceId) return null
    return { productId: id, priceId, mode: 'subscription', sapUnits: 0, planId: sub.plan_id ?? id }
  }

  const packs = (billingProducts as {
    packs?: Record<string, { price_id_env: string; sap_units?: number; credits?: number }>
  }).packs ?? {}
  const pack = packs[id]
  if (pack) {
    const priceId = envPrice(pack.price_id_env)
    if (!priceId) return null
    return {
      productId: id,
      priceId,
      mode: 'payment',
      sapUnits: Number(pack.sap_units ?? 0) || 0,
      planId: null,
    }
  }

  return null
}

/**
 * Anti open-redirect : ne conserve que le chemin (+query) d'une URL fournie
 * par le client et le ré-ancre sur la base publique de l'app.
 */
export function safeReturnUrl(base: string, clientUrl: unknown, fallbackPath: string): string {
  const cleanBase = base.replace(/\/+$/, '')
  const raw = String(clientUrl ?? '').trim()
  if (!raw) return `${cleanBase}${fallbackPath}`
  try {
    const u = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'http://placeholder.local')
    const path = `${u.pathname}${u.search}` || fallbackPath
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
    const relative = path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path
    return `${cleanBase}${relative.startsWith('/') ? relative : `/${relative}`}`
  } catch {
    return `${cleanBase}${fallbackPath}`
  }
}
