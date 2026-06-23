/** Persistance légère de la vue galaxie (session). */
export type GalaxieViewState = {
  zoom: number
  centerX: number
  centerY: number
  filterMode: string
  petalFilter: string
  neighborhood: boolean
}

const STORAGE_KEY = 'jardin_galaxie_view_v1'

export function loadGalaxieView(): Partial<GalaxieViewState> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<GalaxieViewState>
  } catch {
    return null
  }
}

export function saveGalaxieView(state: GalaxieViewState) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota */
  }
}

export const PETAL_IDS = [
  'agape',
  'philautia',
  'mania',
  'storge',
  'pragma',
  'philia',
  'ludus',
  'eros',
] as const

export type BoussoleMode = 'all' | 'mirror' | 'complement'

function normPetal(v: number | undefined): number {
  return Math.max(0, Math.min(1, Number(v ?? 0) / 3))
}

/** Similarité globale (Fleurs miroirs). */
export function resonanceBetween(
  scoresA: Record<string, number> | undefined,
  scoresB: Record<string, number> | undefined,
): number {
  if (!scoresA || !scoresB) return 0
  let sum = 0
  for (const p of PETAL_IDS) {
    const a = normPetal(scoresA[p])
    const b = normPetal(scoresB[p])
    sum += 1 - Math.min(1, Math.abs(a - b))
  }
  return sum / PETAL_IDS.length
}

/**
 * Complémentarité : l'autre apporte ce que je explore peu (ou un pétale ciblé).
 * `focusPetal` = pétale que je cherche à équilibrer (filtre Prairie ou besoin auto).
 */
export function complementarityBetween(
  scoresMe: Record<string, number> | undefined,
  scoresOther: Record<string, number> | undefined,
  focusPetal?: string | null
): number {
  if (!scoresMe || !scoresOther) return 0
  if (focusPetal && PETAL_IDS.includes(focusPetal as (typeof PETAL_IDS)[number])) {
    const gap = Math.max(0, 0.55 - normPetal(scoresMe[focusPetal]))
    const offer = normPetal(scoresOther[focusPetal])
    return Math.min(1, gap * 1.4 + offer * 0.6)
  }
  let sum = 0
  for (const p of PETAL_IDS) {
    const me = normPetal(scoresMe[p])
    const other = normPetal(scoresOther[p])
    const need = Math.max(0, 0.5 - me)
    sum += need * other
  }
  return Math.min(1, sum / PETAL_IDS.length)
}

/** Pétales les moins nourris chez moi (pour suggérer un focus complément). */
export function weakestPetals(
  scores: Record<string, number> | undefined,
  limit = 2
): string[] {
  if (!scores) return []
  return [...PETAL_IDS]
    .map((id) => ({ id, v: normPetal(scores[id]) }))
    .sort((a, b) => a.v - b.v)
    .slice(0, limit)
    .map((x) => x.id)
}

export function matchScore(
  mode: BoussoleMode,
  scoresMe: Record<string, number> | undefined,
  scoresOther: Record<string, number> | undefined,
  focusPetal?: string | null
): number {
  if (mode === 'complement') {
    return complementarityBetween(scoresMe, scoresOther, focusPetal)
  }
  if (mode === 'mirror') {
    return resonanceBetween(scoresMe, scoresOther)
  }
  return resonanceBetween(scoresMe, scoresOther)
}

export const BOUSSOLE_MIRROR_THRESHOLD = 0.55
export const BOUSSOLE_COMPLEMENT_THRESHOLD = 0.42
