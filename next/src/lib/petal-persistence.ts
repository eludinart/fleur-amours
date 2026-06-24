/**
 * Détecte une zone d'ombre persistante (sessions répétées ou tirages sur le même pétale)
 * pour proposer une passerelle vers un accompagnant.
 */
import { PETAL_ORDER } from './petal-tarot'
import { inferShadowPetalFromText } from './petal-shadow'

const CARD_TO_PETAL: Record<string, string> = {
  Agapè: 'agape',
  Philautia: 'philautia',
  Mania: 'mania',
  Storgè: 'storge',
  Pragma: 'pragma',
  Philia: 'philia',
  Ludus: 'ludus',
  Éros: 'eros',
}

export type CoachGatewayHint = {
  petalId: string
  sessionHits: number
  readingHits: number
}

/** Compte les sessions récentes avec déficit marqué sur un pétale. */
function sessionDeficitHits(sessions: Array<Record<string, unknown>>): Record<string, number> {
  const hits = Object.fromEntries(PETAL_ORDER.map((id) => [id, 0])) as Record<string, number>
  for (const s of sessions.slice(0, 20)) {
    const sd = s.step_data as Record<string, unknown> | undefined
    const raw = (sd?.petalsDeficit ?? sd?.petals_deficit) as Record<string, number> | undefined
    if (!raw) continue
    for (const id of PETAL_ORDER) {
      if (Number(raw[id] ?? 0) >= 0.08) hits[id] += 1
    }
  }
  return hits
}

/** Compte les tirages dont la carte principale pointe vers un pétale. */
function readingPetalHits(readings: Array<Record<string, unknown>>): Record<string, number> {
  const hits = Object.fromEntries(PETAL_ORDER.map((id) => [id, 0])) as Record<string, number>
  for (const r of readings.slice(0, 30)) {
    const type = String(r.type ?? 'simple')
    const names: string[] = []
    if (type === 'four' && Array.isArray(r.cards)) {
      for (const c of r.cards as Array<{ name?: string }>) {
        if (c?.name) names.push(c.name)
      }
    } else {
      const card = (r.card || (r.cards as unknown[])?.[0]) as { name?: string } | undefined
      if (card?.name) names.push(card.name)
    }
    const petals = new Set<string>()
    for (const name of names) {
      const pid = CARD_TO_PETAL[name]
      if (pid) petals.add(pid)
    }
    if (petals.size === 1) {
      const [only] = [...petals]
      hits[only] += 1
    } else if (petals.size === 0) {
      const synth = String(r.synthesis ?? r.interpretation ?? '').trim()
      const inferred = inferShadowPetalFromText(synth)
      if (inferred) hits[inferred] += 1
    }
  }
  return hits
}

export function detectCoachGateway(params: {
  sessions: Array<Record<string, unknown>>
  readings: Array<Record<string, unknown>>
  shadowPetalIds?: string[]
}): CoachGatewayHint | null {
  const sessionHits = sessionDeficitHits(params.sessions)
  const readingHits = readingPetalHits(params.readings)

  let best: CoachGatewayHint | null = null
  for (const id of params.shadowPetalIds?.length ? params.shadowPetalIds : PETAL_ORDER) {
    const s = sessionHits[id] ?? 0
    const r = readingHits[id] ?? 0
    if (s >= 3 || r >= 2) {
      const weight = s * 2 + r
      if (!best || weight > best.sessionHits * 2 + best.readingHits) {
        best = { petalId: id, sessionHits: s, readingHits: r }
      }
    }
  }
  return best
}
