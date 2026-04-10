/**
 * Origine absolue pour og:url / og:image (crawlers LinkedIn, Facebook, etc.).
 *
 * Quand un lien est partagé, le crawler ouvre **exactement** cette URL. Les balises
 * og:url / og:image doivent donc utiliser **le même hôte** que la requête entrante,
 * sinon LinkedIn refuse souvent l’aperçu (domaine incohérent).
 *
 * On utilise l’hôte des en-têtes **seulement** s’il ressemble à un nom public sur Internet
 * (évite les noms Docker à une étiquette : `web`, `next`, etc.).
 * Sinon on retombe sur APP_PUBLIC_URL / NEXT_PUBLIC_APP_URL comme ailleurs dans l’app.
 */
import { headers } from 'next/headers'
import { getAppPublicOrigin } from '@/lib/app-public-url'

function isLocalOrIpHost(host: string): boolean {
  const h = host.split(':')[0].toLowerCase()
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true
  return false
}

/** Hôte probablement joignable depuis Internet (pas service Docker court, pas IP locale). */
function isLikelyPublicInternetHost(host: string): boolean {
  const hostname = host.split(':')[0].toLowerCase()
  if (!hostname || isLocalOrIpHost(hostname)) return false
  // `web`, `api`, `next` (Compose) → pas fiable pour og:image
  if (!hostname.includes('.')) return false
  return true
}

export async function getSocialPreviewOrigin(): Promise<string> {
  try {
    const h = await headers()
    const hostRaw = h.get('x-forwarded-host') ?? h.get('host') ?? ''
    const host = hostRaw.split(',')[0].trim()
    if (host && isLikelyPublicInternetHost(host)) {
      const proto = (h.get('x-forwarded-proto') ?? 'https').split(',')[0].trim() || 'https'
      let origin = `${proto}://${host}`.replace(/\/+$/, '')
      // Port explicite non standard : garder ; :443 / :80 inutiles pour les URLs absolues OG
      try {
        const u = new URL(origin)
        if (u.port === '443' && u.protocol === 'https:') {
          u.port = ''
          origin = u.origin
        }
        if (u.port === '80' && u.protocol === 'http:') {
          u.port = ''
          origin = u.origin
        }
      } catch {
        /* garder origin tel quel */
      }
      return origin
    }
  } catch {
    /* build statique / prerender */
  }

  const fromEnv = getAppPublicOrigin()?.replace(/\/+$/, '')
  if (fromEnv) return fromEnv

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
  if (site?.startsWith('http')) return site

  return 'https://www.eludein.art'
}
