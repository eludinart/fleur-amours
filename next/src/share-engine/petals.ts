/**
 * Partie « fleur » du moteur de partage : données publiques uniquement (scores normalisés).
 */
import { PETAL_ORDER_IDS } from '@/lib/petal-theme'

export type ShareFlowerSnapshot = {
  petals: Record<string, number>
  /** Optionnel : traçabilité */
  capturedAt?: string
  /** Pétales accentués par le tirage (ids canoniques). */
  drawPetalIds?: string[]
}

/** Extrait un objet pétales sûr pour JSON public / OG (clés canoniques, valeurs 0–1). */
export function sanitizeShareFlowerPetals(input: Record<string, unknown> | null | undefined): Record<string, number> {
  if (!input || typeof input !== 'object') return {}
  const out: Record<string, number> = {}
  for (const id of PETAL_ORDER_IDS) {
    const v = input[id]
    if (typeof v !== 'number' || Number.isNaN(v)) continue
    const x = v > 1.05 ? Math.min(1, v / 100) : Math.min(1, Math.max(0, v))
    out[id] = x
  }
  return out
}

export function pickDominantPetalId(petals: Record<string, number>): string | null {
  let best = -1
  let id: string | null = null
  for (const [k, v] of Object.entries(petals)) {
    if (typeof v === 'number' && v > best) {
      best = v
      id = k
    }
  }
  return id
}

function sanitizeDrawPetalIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const allowed = new Set(PETAL_ORDER_IDS)
  const out: string[] = []
  for (const x of raw) {
    if (typeof x !== 'string') continue
    const id = x.trim()
    if (!allowed.has(id) || out.includes(id)) continue
    out.push(id)
  }
  return out.length ? out : undefined
}

export function parseShareFlowerFromPayload(
  raw: unknown
): ShareFlowerSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const petals = sanitizeShareFlowerPetals(o.petals as Record<string, unknown>)
  if (Object.keys(petals).length === 0) return null
  const capturedAt = typeof o.capturedAt === 'string' ? o.capturedAt : undefined
  const drawPetalIds = sanitizeDrawPetalIds(o.drawPetalIds)
  return { petals, capturedAt, ...(drawPetalIds ? { drawPetalIds } : {}) }
}
