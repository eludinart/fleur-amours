/**
 * Utilitaires pour le partage Dreamscape (URL + image réseaux sociaux).
 */

const SOCIAL_WIDTH = 1200
const SOCIAL_HEIGHT = 630
const BRAND_TEXT = "Promenade Onirique — Fleur d'AmOurs"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

/**
 * Retourne l'URL de base pour les liens partagés.
 */
export function getShareBaseUrl(): string {
  if (typeof window === 'undefined') return appUrl ? String(appUrl).replace(/\/+$/, '') : ''
  if (appUrl) return String(appUrl).replace(/\/+$/, '')
  return `${window.location.origin}${basePath}`.replace(/\/+$/, '')
}

/**
 * URL de l'image de partage (pour og:image).
 */
export function getSharedImageUrl(token: string | null): string {
  const base = apiUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base.replace(/\/+$/, '')}/api/dreamscape/shared-image?token=${encodeURIComponent(token || '')}`
}

/**
 * Génère une image 1200x630 optimisée pour les réseaux sociaux.
 */
export async function buildSocialCardImage(snapshotBase64: string | null): Promise<string | null> {
  if (!snapshotBase64) return null

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = SOCIAL_WIDTH
      canvas.height = SOCIAL_HEIGHT
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(snapshotBase64)
        return
      }
      const gradient = ctx.createLinearGradient(0, 0, SOCIAL_WIDTH, SOCIAL_HEIGHT)
      gradient.addColorStop(0, '#0f172a')
      gradient.addColorStop(0.5, '#1e293b')
      gradient.addColorStop(1, '#0f172a')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, SOCIAL_WIDTH, SOCIAL_HEIGHT)
      const imgRatio = img.width / img.height
      const targetRatio = SOCIAL_WIDTH / SOCIAL_HEIGHT
      let drawW: number, drawH: number, drawX: number, drawY: number
      if (imgRatio > targetRatio) {
        drawW = SOCIAL_WIDTH
        drawH = SOCIAL_WIDTH / imgRatio
        drawX = 0
        drawY = (SOCIAL_HEIGHT - drawH) / 2
      } else {
        drawH = SOCIAL_HEIGHT
        drawW = SOCIAL_HEIGHT * imgRatio
        drawX = (SOCIAL_WIDTH - drawW) / 2
        drawY = 0
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH)
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(0, SOCIAL_HEIGHT - 80, SOCIAL_WIDTH, 80)
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = 'bold 28px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(BRAND_TEXT, SOCIAL_WIDTH / 2, SOCIAL_HEIGHT - 40)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(snapshotBase64)
    img.src = snapshotBase64
  })
}
