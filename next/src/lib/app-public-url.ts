/**
 * Origine et chemins absolus du site (liens e-mail, invitations, FCM…).
 * Priorité : APP_PUBLIC_URL / NEXT_PUBLIC_APP_URL puis APP_HOST.
 *
 * Origine canonique du Jardin (VPS Coolify) : app-fleurdamours.eludein.art — pas www (Hostinger).
 */
import type { NextRequest } from 'next/server'

/** Hôte public de l’application Next (/jardin) — e-mails, invitations, CTAs. */
export const CANONICAL_JARDIN_ORIGIN = 'https://app-fleurdamours.eludein.art'

function normalizedBasePathSegment(): string {
  const raw = (process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin').trim()
  return raw.replace(/^\/+|\/+$/g, '') || 'jardin'
}

/** Retire le suffixe /{basePath} d’une URL complète si présent. */
function originWithoutAppBasePath(full: string): string {
  const seg = normalizedBasePathSegment()
  let u = full.trim().replace(/\/+$/, '')
  if (!u.includes('://')) return u
  const suffix = `/${seg}`
  if (u.toLowerCase().endsWith(suffix.toLowerCase())) {
    u = u.slice(0, -suffix.length).replace(/\/+$/, '')
  }
  return u
}

/** Hôtes vitrine / autres — les liens applicatifs pointent vers app-fleurdamours.eludein.art. */
const NON_APP_REPLACE_HOSTS = new Set([
  'www.eludein.art',
  'eludein.art',
  'legacy.eludein.art',
  'app.eludein.art',
])

function coerceJardinAppOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/+$/, '')
  if (!trimmed) return CANONICAL_JARDIN_ORIGIN
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    if (NON_APP_REPLACE_HOSTS.has(u.hostname.toLowerCase())) {
      return CANONICAL_JARDIN_ORIGIN
    }
  } catch {
    /* garder origin */
  }
  return trimmed
}

export function getAppPublicOrigin(): string {
  let raw = (process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').trim()
  let appUrl = raw.replace(/\/+$/, '')

  if (appUrl && appUrl.includes('://')) {
    appUrl = originWithoutAppBasePath(appUrl)
  }

  if (!appUrl || appUrl.includes('localhost') || appUrl.startsWith('http://')) {
    const host = process.env.APP_HOST ?? process.env.VIRTUAL_HOST ?? ''
    const h = host.replace(/^https?:\/\//, '').split('/')[0].replace(/\/$/, '')
    appUrl = h ? `https://${h}` : ''
  }
  if (!appUrl) {
    appUrl = CANONICAL_JARDIN_ORIGIN
  }
  return coerceJardinAppOrigin(appUrl)
}

/** Si les variables d’environnement manquent (ex. oubli en déploiement), déduit l’hôte depuis la requête proxy. */
export function resolveAppPublicOrigin(req?: NextRequest): string {
  const fromEnv = getAppPublicOrigin()
  if (fromEnv) return fromEnv
  if (!req) return CANONICAL_JARDIN_ORIGIN
  const hostRaw = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  const host = hostRaw.split(',')[0].trim()
  if (!host) return ''
  const proto = (req.headers.get('x-forwarded-proto') ?? 'https').split(',')[0].trim() || 'https'
  return `${proto}://${host}`.replace(/\/$/, '')
}

export function withPublicBasePath(rel: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
  const bp = basePath.replace(/\/$/, '')
  if (!rel || rel === '/') return bp
  if (rel.startsWith('http')) return rel
  const r = rel.startsWith('/') ? rel : `/${rel}`
  if (r === bp || r.startsWith(`${bp}/`)) return r
  return `${bp}${r}`
}

/** Chemin relatif à la racine du Next app (ex. `/login?…`) → URL absolue HTTPS si possible. */
export function absolutePublicAppUrl(pathFromAppRoot: string, req?: NextRequest): string {
  const origin = resolveAppPublicOrigin(req)
  const path = withPublicBasePath(pathFromAppRoot)
  return `${origin}${path}`
}
