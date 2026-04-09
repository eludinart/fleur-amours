/** Cartes « Amour » (porte love) — noms exacts pour ?landing_card= et données tarot. */
export const PETAL_TO_LANDING_CARD: Record<string, string> = {
  agape: 'Agapè',
  philautia: 'Philautia',
  mania: 'Mania',
  storge: 'Storgè',
  pragma: 'Pragma',
  philia: 'Philia',
  ludus: 'Ludus',
  eros: 'Éros',
}

export const PETAL_ORDER = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const

export function dominantPetalId(petals: Record<string, number> | null | undefined): string | null {
  if (!petals || typeof petals !== 'object') return null
  let best: string | null = null
  let bestV = -1
  for (const p of PETAL_ORDER) {
    const v = Number(petals[p] ?? 0)
    if (v > bestV) {
      bestV = v
      best = p
    }
  }
  return bestV > 0.04 ? best : null
}

/** Pétales les plus marqués (étiquettes ancrées sur la fleur, ex. vue zen). */
export function topPetalIds(
  petals: Record<string, number> | null | undefined,
  limit = 3,
  minV = 0.04
): string[] {
  if (!petals || typeof petals !== 'object') return []
  const rows = PETAL_ORDER.map((id) => ({ id, v: Number(petals[id] ?? 0) }))
    .filter((x) => x.v > minV)
    .sort((a, b) => b.v - a.v)
  const out: string[] = []
  for (const r of rows) {
    if (out.length >= limit) break
    out.push(r.id)
  }
  return out
}

/** Pétale « vide ou faible » : en dessous du seuil on propose un tirage ciblé. */
export function isPetalWeakForDraw(intensity: number, threshold = 0.32): boolean {
  return intensity <= threshold
}

/**
 * Filtre clics sur la fleur (dashboard / zen) : priorité aux pétales faibles.
 * Si aucun n'est faible (profil équilibré), retourne null → tous les pétales restent cliquables.
 */
export function weakPetalsClickFilter(petals: Record<string, number> | null | undefined): Set<string> | null {
  if (!petals || typeof petals !== 'object') return null
  const s = new Set<string>()
  for (const id of PETAL_ORDER) {
    if (isPetalWeakForDraw(Number(petals[id] ?? 0))) s.add(id)
  }
  return s.size > 0 ? s : null
}

export function landingCardForPetal(petalId: string): string | null {
  return PETAL_TO_LANDING_CARD[petalId] ?? null
}
