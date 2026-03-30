import { api } from '@/lib/api-client'
import { fleurApi } from './fleur'
import { tarotReadingsApi } from './tarotReadings'
import { sessionsApi } from './sessions'
import { billingApi } from './billing'
import { dreamscapeApi } from './dreamscape'
import { prairieApi } from './prairie'

function formatShortDate(s: string | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const EMPTY_STATS = {
  sessions_count: 0,
  cards_revealed: 0,
  token_balance: 0,
  eternal_sap: 0,
  total_accumulated_eternal: 0,
  fleur_count: 0,
  fleur_solo_count: 0,
  fleur_duo_count: 0,
  readings_count: 0,
  dreamscape_count: 0,
}

export async function fetchDashboardData() {
  try {
  const [accessRes, sessionsRes, fleurRes, readingsRes, dreamscapeRes, prairieRes] =
    await Promise.allSettled([
      billingApi.getAccess(),
      sessionsApi.my(),
      fleurApi.getMyResults(),
      tarotReadingsApi.my(),
      dreamscapeApi.my(),
      prairieApi.getFleurs(),
    ])

  const access = accessRes.status === 'fulfilled' ? accessRes.value : null
  const sessions = sessionsRes.status === 'fulfilled' ? (sessionsRes.value as { items?: unknown[] })?.items ?? [] : []
  const fleurItems = fleurRes.status === 'fulfilled' ? (fleurRes.value as { items?: unknown[] })?.items ?? [] : []
  const readings = readingsRes.status === 'fulfilled' ? (readingsRes.value as { items?: unknown[] })?.items ?? [] : []
  const dreamscapeItems = dreamscapeRes.status === 'fulfilled' ? (dreamscapeRes.value as { items?: unknown[] })?.items ?? [] : []
  const prairieData = prairieRes.status === 'fulfilled' ? prairieRes.value : null
  const prairieFleurs = (prairieData as { fleurs?: unknown[] })?.fleurs ?? []
  const prairieLinks = (prairieData as { links?: unknown[] })?.links ?? []
  const prairieMeFleur = (prairieData as { me_fleur?: unknown })?.me_fleur ?? null

  // Scores Fleur : renvoyés par GET /api/fleur/my-results (évite N appels getResult / getDuoResult).
  // Fallback réseau uniquement pour les entrées sans scores (ex. fleur-beta ou ancien client).
  const fleurSlice = (fleurItems as Record<string, unknown>[]).slice(0, 20)

  function hasServerScores(item: Record<string, unknown>): boolean {
    const s = item.scores
    if (!s || typeof s !== 'object' || Array.isArray(s)) return false
    const o = s as Record<string, unknown>
    return ['agape', 'philia', 'eros'].some((k) => typeof o[k] === 'number' && !Number.isNaN(Number(o[k])))
  }

  const n = fleurSlice.length
  const fleurSlots: Array<Record<string, unknown> | undefined> = new Array(n)
  const fleurPromises: Promise<void>[] = []

  fleurSlice.forEach((item, i) => {
    if (hasServerScores(item)) {
      const typ = item.type === 'duo' ? 'duo' : item.type === 'fleur-beta' ? 'fleur-beta' : 'solo'
      fleurSlots[i] = { ...item, type: typ }
    } else if ((item.type === 'duo' && item.token) || item.id) {
      fleurPromises.push(
        (async () => {
          try {
            if (item.type === 'duo' && item.token) {
              const duo = await fleurApi.getDuoResult(item.token as string)
              const personA = (duo as Record<string, unknown>)?.person_a as Record<string, unknown> | undefined
              if (personA?.scores) {
                fleurSlots[i] = { ...item, scores: personA.scores, type: 'duo' }
              }
            } else if (item.id) {
              const res = await fleurApi.getResult(item.id as string)
              if ((res as Record<string, unknown>)?.scores) {
                fleurSlots[i] = {
                  ...item,
                  scores: (res as Record<string, unknown>).scores,
                  type: 'solo',
                }
              }
            }
          } catch {
            /* ignore */
          }
        })()
      )
    }
  })

  if (fleurPromises.length > 0) {
    await Promise.all(fleurPromises)
  }

  const fleurResultsWithScores: Array<Record<string, unknown>> = fleurSlots.filter(
    (x): x is Record<string, unknown> => x != null
  )

  const cardsRevealed =
    (sessions as { cards_drawn?: unknown[] }[]).reduce(
      (acc, s) => acc + (s.cards_drawn?.length ?? 0),
      0
    ) +
    (readings as { cards?: unknown[]; card?: unknown }[]).reduce((acc, r) => {
      if (r.cards) return acc + (r.cards as unknown[]).length
      if (r.card) return acc + 1
      return acc
    }, 0)

  const fleurSoloCount = (fleurItems as { type?: string }[]).filter((f) => f.type !== 'duo').length
  const fleurDuoCount = (fleurItems as { type?: string }[]).filter((f) => f.type === 'duo').length

  const stats = {
    sessions_count: (sessions as unknown[]).length,
    cards_revealed: cardsRevealed,
    token_balance: (access as Record<string, unknown>)?.token_balance ?? 0,
    eternal_sap: (access as Record<string, unknown>)?.eternal_sap ?? 0,
    total_accumulated_eternal: (access as Record<string, unknown>)?.total_accumulated_eternal ?? 0,
    fleur_count: (fleurItems as unknown[]).length,
    fleur_solo_count: fleurSoloCount,
    fleur_duo_count: fleurDuoCount,
    readings_count: (readings as unknown[]).length,
    dreamscape_count: (dreamscapeItems as unknown[]).length,
  }

  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

  const chronicle: Array<Record<string, unknown>> = []

  const PETAL_IDS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']
  const CARD_TO_PETAL: Record<string, string> = {
    Agapè: 'agape',
    Philautia: 'philautia',
    Mania: 'mania',
    Storgè: 'storge',
    Pragma: 'pragma',
    Philia: 'philia',
    Ludus: 'ludus',
    'Éros': 'eros',
  }

  function scoresTo01(scores: Record<string, number> | undefined, maxScale = 5) {
    if (!scores) return {} as Record<string, number>
    const out: Record<string, number> = {}
    for (const p of PETAL_IDS) {
      out[p] = Math.min(1, Math.max(0, (scores[p] ?? 0) / maxScale))
    }
    return out
  }

  for (const s of sessions as Record<string, unknown>[]) {
    const createdAt = s.created_at ? new Date(s.created_at as string).getTime() : 0
    if (createdAt < thirtyDaysAgo) continue
    const plan = (s.step_data as Record<string, unknown>)?.plan14j ?? s.plan14j
    const synthesis = (plan as Record<string, unknown>)?.synthesis || (plan as Record<string, unknown>)?.synthesis_suggestion
    if (synthesis) {
      chronicle.push({ type: 'session', id: s.id, synthesis, created_at: s.created_at })
    }
    const anchors = (s.anchors ?? []) as Array<{ synthesis?: string }>
    anchors.forEach((a) => {
      if (a?.synthesis) {
        chronicle.push({ type: 'session_anchor', id: s.id, synthesis: a.synthesis, created_at: s.created_at })
      }
    })
  }
  for (const r of readings as Record<string, unknown>[]) {
    const createdAt = r.createdAt ? new Date(r.createdAt as string).getTime() : 0
    if (createdAt < thirtyDaysAgo) continue
    if (r.synthesis) {
      chronicle.push({ type: 'tirage', id: r.id, synthesis: r.synthesis, created_at: r.createdAt })
    }
  }
  for (const d of dreamscapeItems as Record<string, unknown>[]) {
    const createdAt = d.savedAt ? new Date(d.savedAt as string).getTime() : 0
    if (createdAt < thirtyDaysAgo) continue
    const history = d.history as Array<{ role: string; content: string }> | undefined
    const synthesis =
      (d.poeticReflection as string) || history?.find((m) => m.role === 'assistant')?.content || 'Promenade onirique'
    chronicle.push({ type: 'dreamscape', id: d.id, synthesis, created_at: d.savedAt })
  }
  chronicle.sort((a, b) => new Date((b.created_at as string) || 0).getTime() - new Date((a.created_at as string) || 0).getTime())

  const petalsAggregate: Record<string, number> = {}
  PETAL_IDS.forEach((p) => {
    petalsAggregate[p] = 0
  })
  let petalsCount = 0

  for (const fr of fleurResultsWithScores) {
    const scores = fr.scores as Record<string, number> | undefined
    if (scores) {
      const p01 = scoresTo01(scores)
      PETAL_IDS.forEach((p) => {
        petalsAggregate[p] += p01[p] ?? 0
      })
      petalsCount++
    }
  }
  for (const s of sessions as Record<string, unknown>[]) {
    const p = s.petals as Record<string, number> | undefined
    if (p && typeof p === 'object') {
      PETAL_IDS.forEach((id) => {
        petalsAggregate[id] += Math.min(1, Math.max(0, p[id] ?? 0))
      })
      petalsCount++
    }
  }
  for (const r of readings as Record<string, unknown>[]) {
    const card = (r.card || (r.cards as unknown[])?.[0]) as
      | { name?: string }
      | undefined
    const name = card?.name
    if (name && CARD_TO_PETAL[name]) {
      petalsAggregate[CARD_TO_PETAL[name]] += 0.5
      petalsCount++
    }
  }
  for (const d of dreamscapeItems as Record<string, unknown>[]) {
    const p = d.petals as Record<string, number> | undefined
    if (p && typeof p === 'object') {
      PETAL_IDS.forEach((id) => {
        petalsAggregate[id] += Math.min(1, Math.max(0, p[id] ?? 0))
      })
      petalsCount++
    }
  }

  const petalsMax = Math.max(...Object.values(petalsAggregate), 0.01)
  const petals_aggregate = Object.fromEntries(
    PETAL_IDS.map((p) => [p, Math.min(1, petalsAggregate[p] / petalsMax)])
  )

  const sessions30d = (sessions as Record<string, unknown>[]).filter((s) => {
    const t = s.created_at ? new Date(s.created_at as string).getTime() : 0
    return t >= thirtyDaysAgo
  })
  const petalsAvg30d: Record<string, number> = {}
  PETAL_IDS.forEach((p) => {
    petalsAvg30d[p] = 0
  })
  let avgCount = 0
  for (const s of sessions30d) {
    const p = s.petals as Record<string, number> | undefined
    if (p && typeof p === 'object') {
      PETAL_IDS.forEach((id) => {
        petalsAvg30d[id] += Math.min(1, Math.max(0, p[id] ?? 0))
      })
      avgCount++
    }
  }
  if (avgCount > 0) {
    PETAL_IDS.forEach((p) => {
      petalsAvg30d[p] /= avgCount
    })
  }
  const petals_avg_30d = petalsAvg30d

  const timeline: Array<Record<string, unknown>> = []
  for (const s of sessions as Record<string, unknown>[]) {
    const p = s.petals as Record<string, number> | undefined
    if (p && typeof p === 'object') {
      const normalized: Record<string, number> = {}
      PETAL_IDS.forEach((id) => {
        normalized[id] = Math.min(1, Math.max(0, p[id] ?? 0))
      })
      timeline.push({
        id: s.id,
        date: s.created_at,
        label: (s.first_words as string) ? `${(s.first_words as string).slice(0, 30)}…` : formatShortDate(s.created_at as string),
        petals: normalized,
        type: 'session',
      })
    }
  }
  for (const fr of fleurResultsWithScores) {
    const scores = fr.scores as Record<string, number> | undefined
    if (scores) {
      const p01 = scoresTo01(scores)
      timeline.push({
        id: fr.id,
        date: fr.created_at,
        label: fr.type === 'duo' ? 'Fleur DUO' : 'Ma Fleur',
        petals: p01,
        type: 'fleur',
      })
    }
  }
  for (const d of dreamscapeItems as Record<string, unknown>[]) {
    const p = d.petals as Record<string, number> | undefined
    if (p && typeof p === 'object') {
      const normalized: Record<string, number> = {}
      PETAL_IDS.forEach((id) => {
        normalized[id] = Math.min(1, Math.max(0, p[id] ?? 0))
      })
      timeline.push({
        id: d.id,
        date: d.savedAt,
        label:
          ((d.poeticReflection as string)?.slice(0, 40) ?? '') +
          ((d.poeticReflection as string)?.length > 40 ? '…' : '') ||
          'Promenade onirique',
        petals: normalized,
        type: 'dreamscape',
      })
    }
  }
  timeline.sort((a, b) => new Date((b.date as string) || 0).getTime() - new Date((a.date as string) || 0).getTime())

  const last5Snapshots = timeline.slice(0, 5)

  return {
    stats,
    sessions,
    fleurResults: fleurResultsWithScores,
    fleurItems,
    readings,
    chronicle: chronicle.slice(0, 20),
    access,
    petals_aggregate,
    petals_avg_30d,
    currentSession: (sessions as Record<string, unknown>[])[0] || null,
    timeline,
    last5Snapshots,
    prairieFleurs,
    prairieLinks,
    prairieMeFleur,
  }
  } catch (err) {
    console.error('fetchDashboardData error:', err)
    return {
      stats: EMPTY_STATS,
      sessions: [],
      fleurResults: [],
      fleurItems: [],
      readings: [],
      chronicle: [],
      access: null,
      petals_aggregate: {} as Record<string, number>,
      petals_avg_30d: {} as Record<string, number>,
      currentSession: null,
      timeline: [],
      last5Snapshots: [],
      prairieFleurs: [],
      prairieLinks: [],
      prairieMeFleur: null,
    }
  }
}

export const dashboardApi = {
  fetchData: fetchDashboardData,
  getInsight: (petals: Record<string, number>, locale = 'fr') =>
    api.post('/api/ai/dashboard-insight', { petals, locale }),
  getTrend: (snapshots: unknown[]) => api.post('/api/ai/dashboard-trend', { snapshots }),
}
