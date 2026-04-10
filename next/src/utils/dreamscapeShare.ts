/**
 * Utilitaires pour le partage Dreamscape (URL publique, image côté API).
 */
import { getAppPublicOrigin } from '@/lib/app-public-url'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''

/**
 * Base absolue pour les liens partagés (Promenade, etc.).
 * En navigateur : toujours `origin` réel + `basePath` — évite un NEXT_PUBLIC_APP_URL
 * pointant vers un autre domaine ou sans `/jardin`, ce qui casse LinkedIn.
 */
export function getShareBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${basePath}`.replace(/\/+$/, '')
  }
  const o = getAppPublicOrigin()
  if (o) return `${o}${basePath}`.replace(/\/+$/, '')
  return ''
}

/**
 * URL de l'image de partage (pour og:image).
 */
export function getSharedImageUrl(token: string | null): string {
  const base = apiUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base.replace(/\/+$/, '')}/api/dreamscape/shared-image?token=${encodeURIComponent(token || '')}`
}
