/** Fond de capture : même valeur que les couches DOM du cadre (évite le blanc si le dégradé ne rend pas). */
export const DREAMSCAPE_SNAPSHOT_BG = '#05030c'

/**
 * Capture PNG (data URL) du bloc visuel Dreamscape — mêmes réglages partout.
 */
export async function captureDreamscapeDomToDataUrl(el: HTMLElement | null): Promise<string | null> {
  if (!el) return null
  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(el, {
      backgroundColor: DREAMSCAPE_SNAPSHOT_BG,
      scale: Math.min(
        2.5,
        typeof window !== 'undefined' ? Math.max(2, (window.devicePixelRatio || 1) * 1.1) : 2
      ),
      useCORS: true,
      allowTaint: true,
      logging: false,
      onclone: (_doc, cloned) => {
        if (cloned instanceof HTMLElement) {
          cloned.style.borderRadius = '12px'
          cloned.style.overflow = 'hidden'
          cloned.style.border = 'none'
          cloned.style.outline = 'none'
          cloned.style.boxShadow = 'none'
          cloned.style.backgroundColor = DREAMSCAPE_SNAPSHOT_BG
          cloned.style.backgroundImage =
            'linear-gradient(165deg, #06041a 0%, #10081f 45%, #05030c 100%)'
        }
      },
    })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}
