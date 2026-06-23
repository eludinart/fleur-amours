/**
 * Fleur SVG statique pour e-mails (serveur, sans React).
 */
import { PETAL_DEFS, PETAL_BY_ID, PETAL_ORDER_IDS } from './petal-theme'

const CENTER = 100
const MIN_LEN = 16
const MAX_LEN = 54
const PETAL_W = 15

function petalPath(halfLen: number, width: number): string {
  const tip = halfLen * 2
  return [
    'M 0 0',
    `C ${-width * 1.1} ${-halfLen * 0.4} ${-width * 0.8} ${-tip * 0.7} 0 ${-tip}`,
    `C ${width * 0.8} ${-tip * 0.7} ${width * 1.1} ${-halfLen * 0.4} 0 0`,
    'Z',
  ].join(' ')
}

/** Normalise les scores en déploiement 0–1 (aligné sur FlowerSVG). */
export function normalizePetalsForEmail(scores: Record<string, number> | null | undefined): Record<string, number> {
  if (!scores || typeof scores !== 'object') return {}
  const vals = Object.values(scores).filter((v) => typeof v === 'number')
  const dataMax = vals.length ? Math.max(...vals) : 0
  const scale = dataMax > 1.05 ? dataMax : 1
  const out: Record<string, number> = {}
  for (const p of PETAL_ORDER_IDS) {
    out[p] = Math.min(1, Math.max(0, (scores[p] ?? 0) / scale))
  }
  return out
}

export function dominantPetalFromScores(scores: Record<string, number>): { id: string; name: string; value: number } | null {
  let best: { id: string; name: string; value: number } | null = null
  for (const id of PETAL_ORDER_IDS) {
    const value = scores[id] ?? 0
    if (!best || value > best.value) {
      best = { id, name: PETAL_BY_ID[id]?.name ?? id, value }
    }
  }
  return best
}

/** SVG inline compatible clients mail modernes (Gmail, Apple Mail, etc.). */
export function buildEmailFlowerSvg(petals: Record<string, number>, size = 220): string {
  const normalized = normalizePetalsForEmail(petals)
  const petalEls: string[] = []

  for (const def of PETAL_DEFS) {
    const deploy = normalized[def.id] ?? 0
    const halfLen = MIN_LEN + (MAX_LEN - MIN_LEN) * deploy
    const opacity = 0.45 + deploy * 0.55
    petalEls.push(
      `<g transform="translate(${CENTER},${CENTER}) rotate(${def.angle})">` +
        `<path d="${petalPath(halfLen, PETAL_W)}" fill="${def.color}" fill-opacity="${opacity.toFixed(2)}" stroke="${def.color}" stroke-width="1.2" stroke-opacity="0.85"/>` +
        `</g>`
    )
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="Fleur d'AmOurs">` +
    `<defs>` +
    `<radialGradient id="core" cx="50%" cy="50%" r="50%">` +
    `<stop offset="0%" stop-color="#fdeef2"/>` +
    `<stop offset="55%" stop-color="#efb0c0" stop-opacity="0.9"/>` +
    `<stop offset="100%" stop-color="#ec8698" stop-opacity="0.5"/>` +
    `</radialGradient>` +
    `</defs>` +
  petalEls.join('') +
    `<circle cx="${CENTER}" cy="${CENTER}" r="14" fill="url(#core)" stroke="#ec8698" stroke-width="1.5" stroke-opacity="0.6"/>` +
    `<circle cx="${CENTER}" cy="${CENTER}" r="5" fill="#ec8698" fill-opacity="0.75"/>` +
    `</svg>`
  )
}
