import { PETAL_ORDER, isPetalWeakForDraw } from './petal-tarot'

export type ShadowZoneReason = 'deficit' | 'weak' | 'chronicle'

export type ShadowZone = {
  petalId: string
  reason: ShadowZoneReason
  /** Plus élevé = plus marqué */
  weight: number
}

const DEFICIT_OMBRE_MIN = 0.05
const DEFICIT_STRONG = 0.1

/** Agrège les déficits pétales des sessions récentes (step_data). */
export function aggregateSessionDeficits(
  sessions: Array<Record<string, unknown>>
): Record<string, number> {
  const out = Object.fromEntries(PETAL_ORDER.map((id) => [id, 0])) as Record<string, number>
  let n = 0
  for (const s of sessions.slice(0, 12)) {
    const sd = s.step_data as Record<string, unknown> | undefined
    const raw = (sd?.petalsDeficit ?? sd?.petals_deficit) as Record<string, number> | undefined
    if (!raw || typeof raw !== 'object') continue
    for (const id of PETAL_ORDER) {
      const v = Number(raw[id] ?? 0)
      if (v > 0) out[id] += v
    }
    n++
  }
  if (n > 0) {
    for (const id of PETAL_ORDER) out[id] /= n
  }
  return out
}

/** Pétales faibles dans le profil agrégé (peu nourris / en retrait). */
export function weakProfilePetals(petals: Record<string, number>): string[] {
  return PETAL_ORDER.filter((id) => isPetalWeakForDraw(Number(petals[id] ?? 0)))
}

export function detectShadowZones(params: {
  petals: Record<string, number>
  deficits?: Record<string, number>
  chronicleShadowPetals?: string[]
}): ShadowZone[] {
  const zones: ShadowZone[] = []
  const seen = new Set<string>()

  for (const id of PETAL_ORDER) {
    const d = Number(params.deficits?.[id] ?? 0)
    if (d >= DEFICIT_OMBRE_MIN) {
      zones.push({
        petalId: id,
        reason: 'deficit',
        weight: d + (d >= DEFICIT_STRONG ? 0.15 : 0),
      })
      seen.add(id)
    }
  }

  for (const id of weakProfilePetals(params.petals)) {
    if (seen.has(id)) continue
    const v = Number(params.petals[id] ?? 0)
    zones.push({ petalId: id, reason: 'weak', weight: Math.max(0.05, 0.34 - v) })
    seen.add(id)
  }

  for (const id of params.chronicleShadowPetals ?? []) {
    if (seen.has(id) || !PETAL_ORDER.includes(id as (typeof PETAL_ORDER)[number])) continue
    zones.push({ petalId: id, reason: 'chronicle', weight: 0.12 })
    seen.add(id)
  }

  return zones.sort((a, b) => b.weight - a.weight).slice(0, 4)
}

/** Infère un pétale depuis une synthèse « ombre » (mots-clés grossiers). */
export function inferShadowPetalFromText(text: string): string | null {
  const s = text.toLowerCase()
  const rules: Array<[string[], string]> = [
    [['philautia', 'estime', 'soi-même', 'soi meme', 'manque de confiance'], 'philautia'],
    [['mania', 'jalous', 'possess', 'fusion', 'dépend'], 'mania'],
    [['agape', 'don ', 'sacrifi', 'oubli de soi'], 'agape'],
    [['storge', 'racine', 'famille', 'attachement', 'loyauté', 'loyaute'], 'storge'],
    [['pragma', 'construire', 'engagement', 'durée', 'duree', 'stabilit'], 'pragma'],
    [['philia', 'amitié', 'amitie', 'loyal', 'camarad'], 'philia'],
    [['ludus', 'jeu', 'légèret', 'legeret', 'distance'], 'ludus'],
    [['eros', 'désir', 'desir', 'sensual', 'passion'], 'eros'],
  ]
  for (const [keys, petal] of rules) {
    if (keys.some((k) => s.includes(k))) return petal
  }
  return null
}

export function chronicleShadowPetals(
  chronicle: Array<Record<string, unknown>>
): string[] {
  const out: string[] = []
  for (const c of chronicle.slice(0, 8)) {
    if (c.tone !== 'shadow') continue
    const syn = String(c.synthesis ?? '')
    const inferred = inferShadowPetalFromText(syn)
    if (inferred && !out.includes(inferred)) out.push(inferred)
  }
  return out
}

export function hasShadowMoment(
  zones: ShadowZone[],
  chronicle: Array<Record<string, unknown>>
): boolean {
  if (zones.length > 0) return true
  return chronicle.slice(0, 6).some((c) => c.tone === 'shadow')
}
