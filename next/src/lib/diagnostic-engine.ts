/**
 * Diagnostic systémique — règles issues des fichiers SCIENCE.
 */
import { readFile } from 'fs/promises'
import { join } from 'path'

const PETALS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const

type InteractionPair = {
  from: string
  to: string
  type: string
  weight: number
}

async function loadInteractionMatrix(): Promise<InteractionPair[]> {
  const path = join(process.cwd(), 'public', 'api', 'data', 'science', 'interaction_matrix.json')
  const raw = await readFile(path, 'utf8')
  const data = JSON.parse(raw) as { pairs?: InteractionPair[] }
  return data.pairs ?? []
}

async function loadInvariants(): Promise<{
  stades_vegetaux?: Array<{ name?: string; slug?: string }>
  climats?: Array<{ name?: string; slug?: string }>
}> {
  const path = join(process.cwd(), 'public', 'api', 'data', 'science', 'invariants_and_dynamics.json')
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw)
}

export async function loadInvariantsForApi(): Promise<Record<string, unknown>> {
  return loadInvariants()
}

function labelForSlug(
  items: Array<{ name?: string; slug?: string }> | undefined,
  slug: string
): string {
  if (!slug) return '—'
  const found = items?.find((i) => String(i.slug ?? '') === slug || String(i.name ?? '').toLowerCase() === slug)
  return found?.name ?? slug
}

export async function runSystemicDiagnostic(payload: {
  coeur?: Record<string, number | undefined>
  temps?: string
  climat?: string
  histoire?: string
  mode?: string
}): Promise<{ synthesis: string; metrics: Record<string, unknown>; interactions: InteractionPair[] }> {
  const coeur = payload.coeur ?? {}
  const weights = PETALS.map((p) => Math.min(1, Math.max(0, Number(coeur[p] ?? 0) || 0)))
  const mean = weights.reduce((a, b) => a + b, 0) / PETALS.length
  const variance = weights.reduce((a, v) => a + (v - mean) ** 2, 0) / PETALS.length
  const stddev = Math.sqrt(variance)
  const polarization = stddev
  const center_score = Math.max(0, 1 - stddev * 2)

  const flags: string[] = []
  if (polarization > 0.6 && center_score < 0.3) flags.push('dominance')
  if (polarization > 0.45) flags.push('polarization')
  if (center_score > 0.7) flags.push('high_center')

  const matrix = await loadInteractionMatrix()
  const invariants = await loadInvariants()
  const interactions: InteractionPair[] = []

  for (const pair of matrix) {
    const fromW = Math.min(1, Math.max(0, Number(coeur[pair.from] ?? 0) || 0))
    const toW = Math.min(1, Math.max(0, Number(coeur[pair.to] ?? 0) || 0))
    if (fromW > 0.12 && toW > 0.12) {
      interactions.push({
        from: pair.from,
        to: pair.to,
        type: pair.type,
        weight: Math.round(pair.weight * ((fromW + toW) / 2) * 1000) / 1000,
      })
    }
  }
  interactions.sort((a, b) => b.weight - a.weight)

  const stageLabel = labelForSlug(invariants.stades_vegetaux, String(payload.temps ?? ''))
  const climatLabel = labelForSlug(invariants.climats, String(payload.climat ?? ''))
  const histoire = String(payload.histoire ?? 'transformation')
  const mode = payload.mode === 'B' ? 'opérationnel' : 'archétypal'

  const dominant = PETALS[weights.indexOf(Math.max(...weights))]
  const synthesis = [
    `Lecture ${mode} : trajectoire « ${histoire} »`,
    `au stade ${stageLabel}`,
    `sous climat ${climatLabel}.`,
    `Pétale dominant : ${dominant}.`,
    `Centre ${Math.round(center_score * 100)} %, polarisation ${Math.round(polarization * 100)} %.`,
    flags.length ? `Signaux : ${flags.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    synthesis,
    metrics: {
      center_score: Math.round(center_score * 1000) / 1000,
      polarization: Math.round(polarization * 1000) / 1000,
      mean: Math.round(mean * 1000) / 1000,
      flags,
      histoire,
      mode: payload.mode ?? 'A',
      dominant_petal: dominant,
    },
    interactions: interactions.slice(0, 12),
  }
}
