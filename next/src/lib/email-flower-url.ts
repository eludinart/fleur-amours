/**
 * URL d'image PNG pour la fleur dans les e-mails (les clients mail bloquent le SVG inline).
 */
import { absolutePublicAppUrl } from './app-public-url'
import { PETAL_ORDER_IDS } from './petal-theme'

export function encodeScoresForEmailFlower(scores: Record<string, number>): string {
  const compact: Record<string, number> = {}
  for (const id of PETAL_ORDER_IDS) {
    const v = scores[id]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      compact[id] = Math.round(v * 1000) / 1000
    }
  }
  return Buffer.from(JSON.stringify(compact)).toString('base64url')
}

export function decodeScoresForEmailFlower(param: string): Record<string, number> {
  try {
    const raw = Buffer.from(param, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, number> = {}
    for (const id of PETAL_ORDER_IDS) {
      const v = parsed[id]
      if (typeof v === 'number' && Number.isFinite(v)) out[id] = v
    }
    return out
  } catch {
    return {}
  }
}

export function buildEmailFlowerImageUrl(scores: Record<string, number>): string {
  const encoded = encodeScoresForEmailFlower(scores)
  if (!encoded || encoded === 'e30') {
    return absolutePublicAppUrl('/juste-la-fleur.png')
  }
  return absolutePublicAppUrl(`/api/og/email-fleur?s=${encoded}`)
}
