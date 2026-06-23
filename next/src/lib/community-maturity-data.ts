/**
 * Badges de maturité communautaire — types et règles (sans DB, importable côté client).
 */

export type MaturityBadgeId = 'sprout' | 'budding' | 'bloom' | 'gardener' | 'pollinator' | 'anchor'

export type MaturityStats = {
  profilePublic: boolean
  seedsSent: number
  seedsReceived: number
  acceptedLinks: number
  arrosagesGiven: number
  arrosagesReceived: number
  pollensSent: number
}

export const MATURITY_BADGE_DEFS: Record<
  MaturityBadgeId,
  { emoji: string; labelKey: string; descKey: string }
> = {
  sprout: { emoji: '🌱', labelKey: 'maturity.sprout', descKey: 'maturity.sproutDesc' },
  budding: { emoji: '🌿', labelKey: 'maturity.budding', descKey: 'maturity.buddingDesc' },
  bloom: { emoji: '🌸', labelKey: 'maturity.bloom', descKey: 'maturity.bloomDesc' },
  gardener: { emoji: '💧', labelKey: 'maturity.gardener', descKey: 'maturity.gardenerDesc' },
  pollinator: { emoji: '🌼', labelKey: 'maturity.pollinator', descKey: 'maturity.pollinatorDesc' },
  anchor: { emoji: '🪴', labelKey: 'maturity.anchor', descKey: 'maturity.anchorDesc' },
}

export function computeMaturityBadges(stats: MaturityStats): MaturityBadgeId[] {
  const out: MaturityBadgeId[] = []
  if (stats.profilePublic) out.push('sprout')
  if (stats.seedsSent > 0 || stats.seedsReceived > 0) out.push('budding')
  if (stats.acceptedLinks >= 1) out.push('bloom')
  if (stats.arrosagesGiven >= 3) out.push('gardener')
  if (stats.pollensSent >= 1) out.push('pollinator')
  if (stats.acceptedLinks >= 2) out.push('anchor')
  return out
}
