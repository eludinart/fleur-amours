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
 * Génère une image 1200x630 optimisée pour les réseaux sociaux (client-side fallback).
 * Utilisée uniquement pour le partage natif mobile quand la route /api/og/dreamscape n'est pas accessible.
 */
export async function buildSocialCardImage(
  snapshotBase64: string | null,
  poeticReflection?: string | null
): Promise<string | null> {
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

      // Background: deep violet-indigo gradient
      const gradient = ctx.createLinearGradient(0, 0, SOCIAL_WIDTH, SOCIAL_HEIGHT)
      gradient.addColorStop(0, '#0a0118')
      gradient.addColorStop(0.5, '#150829')
      gradient.addColorStop(1, '#0a0118')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, SOCIAL_WIDTH, SOCIAL_HEIGHT)

      // Draw snapshot (cover, centered)
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
      ctx.globalAlpha = 0.5
      ctx.drawImage(img, drawX, drawY, drawW, drawH)
      ctx.globalAlpha = 1

      // Gradient overlay bottom
      const overlay = ctx.createLinearGradient(0, SOCIAL_HEIGHT * 0.3, 0, SOCIAL_HEIGHT)
      overlay.addColorStop(0, 'rgba(10,1,24,0)')
      overlay.addColorStop(0.6, 'rgba(10,1,24,0.75)')
      overlay.addColorStop(1, 'rgba(10,1,24,0.95)')
      ctx.fillStyle = overlay
      ctx.fillRect(0, 0, SOCIAL_WIDTH, SOCIAL_HEIGHT)

      // Label: "Promenade Onirique"
      ctx.fillStyle = 'rgba(196,181,253,0.75)'
      ctx.font = '500 15px system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.letterSpacing = '3px'
      ctx.fillText('PROMENADE ONIRIQUE', 56, SOCIAL_HEIGHT - 180)
      ctx.letterSpacing = '0px'

      // Poetic reflection text
      if (poeticReflection) {
        const maxW = SOCIAL_WIDTH - 112
        const shortText = poeticReflection.length > 120 ? poeticReflection.slice(0, 119) + '…' : poeticReflection
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.font = 'italic 26px Georgia, serif'
        ctx.textAlign = 'left'
        // Simple word-wrap: two lines
        const words = shortText.split(' ')
        let line1 = ''
        let line2 = ''
        let onLine2 = false
        for (const w of words) {
          const test = (line1 ? line1 + ' ' : '') + w
          if (!onLine2 && ctx.measureText(test).width > maxW) {
            onLine2 = true
          }
          if (onLine2) {
            line2 += (line2 ? ' ' : '') + w
          } else {
            line1 += (line1 ? ' ' : '') + w
          }
        }
        const finalLine2 = line2.length > 80 ? line2.slice(0, 79) + '…' : line2
        ctx.fillText(`« ${line1}`, 56, SOCIAL_HEIGHT - 140)
        if (finalLine2) ctx.fillText(`${finalLine2} »`, 56, SOCIAL_HEIGHT - 105)
      }

      // Footer bar
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, SOCIAL_HEIGHT - 64, SOCIAL_WIDTH, 64)

      // Separator line
      ctx.strokeStyle = 'rgba(139,92,246,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, SOCIAL_HEIGHT - 64)
      ctx.lineTo(SOCIAL_WIDTH, SOCIAL_HEIGHT - 64)
      ctx.stroke()

      // Brand name
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '500 18px system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('🌸 ' + BRAND_TEXT, 56, SOCIAL_HEIGHT - 26)

      // CTA
      ctx.fillStyle = 'rgba(196,181,253,0.85)'
      ctx.font = '500 16px system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('Vivre ma propre promenade →', SOCIAL_WIDTH - 56, SOCIAL_HEIGHT - 26)

      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(snapshotBase64)
    img.src = snapshotBase64
  })
}
