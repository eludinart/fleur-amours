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

export function resonanceBetween(
  scoresA: Record<string, number> | undefined,
  scoresB: Record<string, number> | undefined,
): number {
  if (!scoresA || !scoresB) return 0
  const petals = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']
  let sum = 0
  let n = 0
  for (const p of petals) {
    const a = (scoresA[p] ?? 0) / 3
    const b = (scoresB[p] ?? 0) / 3
    sum += 1 - Math.min(1, Math.abs(a - b))
    n++
  }
  return n > 0 ? sum / n : 0
}
