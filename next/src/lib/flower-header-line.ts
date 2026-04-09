import { PETAL_DEFS } from '@/lib/petal-theme'
import { PETAL_ORDER } from '@/lib/petal-tarot'

type TFn = (key: string, vars?: Record<string, string | number>) => string

function petalLabel(id: string, tr: TFn): string {
  const key = `fleurZen.petalLabels.${id}`
  const s = tr(key)
  if (s !== key) return s
  return PETAL_DEFS.find((p) => p.id === id)?.name ?? id
}

/**
 * Ligne d’accroche sous le titre (Fleur zen / dashboard), dérivée des scores pétales.
 */
export function personalFlowerHeaderLine(petals: Record<string, number>, tr: TFn): string {
  const vals = PETAL_ORDER.map((id) => ({ id, v: Math.min(1, Math.max(0, Number(petals[id] ?? 0))) }))
  const maxV = Math.max(...vals.map((x) => x.v), 0)
  if (maxV < 0.04) {
    return tr('fleurZen.headerLineNewGarden')
  }
  const sorted = [...vals].sort((a, b) => b.v - a.v)
  const dom = sorted[0].id
  const second = sorted[1]
  const dominant = petalLabel(dom, tr)
  if (!second || second.v < 0.06 || second.id === dom) {
    return tr('fleurZen.headerLineDominantOnly', { dominant })
  }
  return tr('fleurZen.headerLineDominantEcho', {
    dominant,
    echo: petalLabel(second.id, tr),
  })
}

/**
 * Niveau 1 (Fleur zen) : lecture de la **forme** du profil, sans nommer de pétales
 * (évite la redondance avec phrase de pouvoir + souffle temporel).
 */
export function zenReadingLevel1Line(petals: Record<string, number>, tr: TFn): string {
  const vals = PETAL_ORDER.map((id) => Math.min(1, Math.max(0, Number(petals[id] ?? 0))))
  const maxV = Math.max(...vals, 0)
  if (maxV < 0.04) {
    return tr('fleurZen.headerLineNewGarden')
  }
  const minV = Math.min(...vals)
  const spread = maxV - minV
  if (spread >= 0.42) {
    return tr('fleurZen.readingLevel1SpreadWide')
  }
  if (spread <= 0.14) {
    return tr('fleurZen.readingLevel1SpreadTight')
  }
  return tr('fleurZen.readingLevel1Balanced')
}
