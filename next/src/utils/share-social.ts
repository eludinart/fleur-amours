/**
 * URLs de partage pour les réseaux sociaux populaires.
 * Utilisé en fallback sur desktop quand navigator.share n'est pas disponible.
 * Sur mobile, privilégier navigator.share() qui ouvre le menu natif (toutes les apps).
 */

const BRAND = "Fleur d'AmOurs"

export type SharePayload = {
  url: string
  title?: string
  text?: string
}

/**
 * Twitter/X — intent tweet
 */
export function getTwitterShareUrl(payload: SharePayload): string {
  const params = new URLSearchParams()
  if (payload.text) params.set('text', payload.text)
  params.set('url', payload.url)
  if (payload.title && !payload.text) params.set('text', payload.title)
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

/**
 * Facebook — sharer
 */
export function getFacebookShareUrl(payload: SharePayload): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(payload.url)}`
}

/**
 * WhatsApp — Web ou app (fonctionne sur mobile et desktop)
 */
export function getWhatsAppShareUrl(payload: SharePayload): string {
  const text = [payload.text, payload.title, payload.url].filter(Boolean).join(' ') || payload.url
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/**
 * LinkedIn — sharing API
 */
export function getLinkedInShareUrl(payload: SharePayload): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(payload.url)}`
}

/**
 * Vérifie si la Web Share API est disponible (mobile, certains navigateurs).
 */
export function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share
}
