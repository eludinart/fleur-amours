/**
 * Analyse duo (zones stable / adjust / desync / fragile) — gère échelles 0–1 et 0–5.
 */
const PETAL_KEYS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const

export function computeDuoAnalysis(
  person_a: { scores?: Record<string, number> } | null | undefined,
  person_b: { scores?: Record<string, number> } | null | undefined
) {
  const scoresA = person_a?.scores ?? {}
  const scoresB = person_b?.scores ?? {}
  const allVals = [...Object.values(scoresA), ...Object.values(scoresB)].filter(
    (v) => typeof v === 'number'
  )
  const maxVal = allVals.length ? Math.max(...allVals) : 0
  const normalized = maxVal <= 1.05

  const duo: Record<string, number> = {}
  PETAL_KEYS.forEach((k) => {
    duo[k] = ((scoresA[k] ?? 0) + (scoresB[k] ?? 0)) / 2
  })

  const stable: Record<string, number> = {}
  const adjust: Record<string, number> = {}
  const desync: Record<string, number> = {}
  const fragile: Record<string, number> = {}

  const stableDiff = normalized ? 0.1 : 0.5
  const stableAvg = normalized ? 0.4 : 2
  const adjustDiff = normalized ? 0.2 : 1
  const adjustAvg = normalized ? 0.3 : 1.5
  const desyncDiff = normalized ? 0.35 : 1.5

  PETAL_KEYS.forEach((k) => {
    const a = scoresA[k] ?? 0
    const b = scoresB[k] ?? 0
    const diff = Math.abs(a - b)
    const avg = duo[k]
    if (diff <= stableDiff && avg >= stableAvg) stable[k] = avg
    else if (diff <= adjustDiff && avg >= adjustAvg) adjust[k] = avg
    else if (diff > desyncDiff) desync[k] = avg
    else fragile[k] = avg
  })

  return { duo, stable, adjust, desync, fragile }
}
