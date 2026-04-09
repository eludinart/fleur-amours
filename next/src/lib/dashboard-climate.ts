/** Dérive une métaphore « météo intérieure » à partir du texte renvoyé par /api/ai/dashboard-trend (FR/EN/ES). */
export type ClimateKind = 'mist' | 'wind' | 'sun' | 'mixed'

export function climateKindFromTrend(trend: string): ClimateKind {
  const t = trend.trim()
  if (!t) return 'mixed'
  const low = t.toLowerCase()
  if (/\bstable\b|estable|stabil|assez stable|bastante estable/i.test(low)) return 'mist'
  if (
    /\bcalm|cooling|ease|easing|afloj|enfri|détend|detend|vent|wind|frial|rilass/i.test(low)
  )
    return 'wind'
  if (/\bintens|ris(e|ing)|alza|mount|hausse|squeeze|haut\b/i.test(low)) return 'sun'
  return 'mixed'
}
