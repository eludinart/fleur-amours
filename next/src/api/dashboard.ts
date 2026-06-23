import { api } from '@/lib/api-client'
import { fleurApi } from './fleur'
import { fleurBetaApi } from './fleur-beta'
import { tarotReadingsApi } from './tarotReadings'
import { paperDrawApi } from './paperDraw'
import { sessionsApi } from './sessions'
import { billingApi } from './billing'
import { dreamscapeApi } from './dreamscape'
import { prairieApi } from './prairie'
import { isSessionMantraEcho } from '@/lib/session-mantra-echo'
import {
  buildDreamscapeChronicleSummary,
  buildFleurChronicleSummary,
  buildReadingChronicleSummary,
  buildPaperDrawChronicleSummary,
  buildSessionChronicleSummary,
} from '@/lib/chronicle-summary'
import {
  aggregateSessionDeficits,
  chronicleShadowPetals,
  detectShadowZones,
} from '@/lib/petal-shadow'

const PETAL_IDS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const

/** Nombre max d'entrées journal / frise temporelle sur le dashboard. */
const CHRONICLE_MAX = 50
const TIMELINE_SNAPSHOT_MAX = 20
const DASHBOARD_SESSIONS_LIMIT = 50

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

function formatShortDate(s: string | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Libellé court pour le curseur temps (pas l’instantané détaillé). */
function shortTimelineLabel(text: string, fallback: string, max = 56): string {
  const s = text.trim()
  if (!s) return fallback
  if (s.length <= max) return s
  const cut = s.slice(0, max - 1)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 24 ? cut.slice(0, sp) : cut).trim()}…`
}

function sessionTimelineSummary(s: Record<string, unknown>): string {
  const plan = (s.step_data as Record<string, unknown> | undefined)?.plan14j ?? s.plan14j
  const planSynthesis =
    (plan as Record<string, unknown> | null)?.synthesis ||
    (plan as Record<string, unknown> | null)?.synthesis_suggestion
  const anchors = (s.anchors ?? []) as Array<{ synthesis?: string }>
  const anchorSynthesis = [...anchors]
    .reverse()
    .find((a) => typeof a?.synthesis === 'string' && a.synthesis.trim())?.synthesis
  const synthesis = planSynthesis || anchorSynthesis
  if (synthesis) {
    return buildSessionChronicleSummary(String(synthesis), s.first_words as string | undefined, 520)
  }
  const fw = String(s.first_words ?? '').trim()
  if (fw && !isSessionMantraEcho(fw)) return fw
  return ''
}

function readingPetals01(r: Record<string, unknown>): Record<string, number> | null {
  const normalized: Record<string, number> = Object.fromEntries(PETAL_IDS.map((id) => [id, 0]))
  const type = String(r.type ?? 'simple')
  if (type === 'four' && Array.isArray(r.cards)) {
    for (const c of r.cards as Array<{ name?: string }>) {
      const name = c?.name
      if (name && CARD_TO_PETAL[name]) normalized[CARD_TO_PETAL[name]] += 0.25
    }
  } else {
    const card = (r.card || (r.cards as unknown[])?.[0]) as { name?: string } | undefined
    const name = card?.name
    if (name && CARD_TO_PETAL[name]) normalized[CARD_TO_PETAL[name]] = 0.55
  }
  return Object.values(normalized).some((v) => v > 0) ? normalized : null
}

function paperDrawPetals01(r: Record<string, unknown>): Record<string, number> | null {
  const cards = (r.cards as Array<{ name?: string }> | undefined) ?? []
  if (!cards.length) return null
  const normalized: Record<string, number> = Object.fromEntries(PETAL_IDS.map((id) => [id, 0]))
  let hits = 0
  for (const c of cards) {
    const name = c?.name
    if (name && CARD_TO_PETAL[name]) {
      normalized[CARD_TO_PETAL[name]] += 0.55
      hits++
    }
  }
  if (!hits) return null
  const scale = Math.max(1, hits * 0.35)
  PETAL_IDS.forEach((id) => {
    normalized[id] = Math.min(1, normalized[id] / scale)
  })
  return normalized
}

function inferChronicleTone(
  type: string,
  synthesis: unknown
): 'shadow' | 'light' | 'neutral' {
  const s = String(synthesis ?? '').toLowerCase()
  if (!s) return 'neutral'
  const shadowKw = [
    'ombre',
    'difficile',
    'peur',
    'tension',
    'lourd',
    'perte',
    'sombre',
    'crise',
    'douleur',
    'colère',
    'rage',
    'vide',
    'effondrement',
    'shadow',
    'fear',
    'heavy',
    'grief',
    'pain',
    'anger',
    'dark',
    'crisis',
    'loss',
    'empty',
    'anxiety',
    'worry',
    'hard',
    'struggle',
  ]
  const lightKw = [
    'lumière',
    'apais',
    'joie',
    'force',
    'réuss',
    'ouvert',
    'douce',
    'paix',
    'sérén',
    'gratitude',
    'soulag',
    'clair',
    'light',
    'calm',
    'joy',
    'peace',
    'open',
    'soft',
    'clear',
    'relief',
    'hope',
    'ease',
    'gentle',
    'bright',
  ]
  const sh = shadowKw.some((k) => s.includes(k))
  const li = lightKw.some((k) => s.includes(k))
  if (type === 'tirage' || type === 'paper_draw' || type === 'session' || type === 'session_anchor') {
    if (sh && !li) return 'shadow'
    if (li && !sh) return 'light'
  }
  if (type === 'dreamscape') {
    if (sh && !li) return 'shadow'
    if (li && !sh) return 'light'
  }
  return 'neutral'
}

function extractSessionMantra(s: Record<string, unknown> | null | undefined): string | null {
  if (!s) return null
  const sd = s.step_data as Record<string, unknown> | undefined
  const planRaw = sd?.plan14j ?? s.plan14j
  const plan = planRaw && typeof planRaw === 'object' ? (planRaw as Record<string, unknown>) : null
  const syn = plan?.synthesis ?? plan?.synthesis_suggestion
  if (typeof syn === 'string' && syn.trim()) return syn.trim().slice(0, 320)
  const fw = s.first_words
  if (typeof fw === 'string' && fw.trim()) {
    const t = fw.trim().slice(0, 220)
    if (!isSessionMantraEcho(t)) return t
  }
  return null
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
  paper_draw_count: 0,
  dreamscape_count: 0,
}

export async function fetchDashboardData() {
  try {
  const [accessRes, sessionsRes, fleurRes, readingsRes, paperDrawsRes, dreamscapeRes, prairieRes] =
    await Promise.allSettled([
      billingApi.getAccess(),
      sessionsApi.my(undefined, DASHBOARD_SESSIONS_LIMIT),
      fleurApi.getMyResults(),
      tarotReadingsApi.my(),
      paperDrawApi.my(),
      dreamscapeApi.my(),
      prairieApi.getFleurs(),
    ])

  const access = accessRes.status === 'fulfilled' ? accessRes.value : null
  const sessions = sessionsRes.status === 'fulfilled' ? (sessionsRes.value as { items?: unknown[] })?.items ?? [] : []
  const fleurItems = fleurRes.status === 'fulfilled' ? (fleurRes.value as { items?: unknown[] })?.items ?? [] : []
  const readings = readingsRes.status === 'fulfilled' ? (readingsRes.value as { items?: unknown[] })?.items ?? [] : []
  const paperDraws =
    paperDrawsRes.status === 'fulfilled' ? (paperDrawsRes.value as { items?: unknown[] })?.items ?? [] : []
  const dreamscapeItems = dreamscapeRes.status === 'fulfilled' ? (dreamscapeRes.value as { items?: unknown[] })?.items ?? [] : []
  const prairieData = prairieRes.status === 'fulfilled' ? prairieRes.value : null
  const prairieFleurs = (prairieData as { fleurs?: unknown[] })?.fleurs ?? []
  const prairieLinks = (prairieData as { links?: unknown[] })?.links ?? []
  const prairieMeFleur = (prairieData as { me_fleur?: unknown })?.me_fleur ?? null

  // Scores Fleur : renvoyés par GET /api/fleur/my-results (évite N appels getResult / getDuoResult).
  // Fallback réseau uniquement pour les entrées sans scores (ex. fleur-beta ou ancien client).
  const fleurSlice = (fleurItems as Record<string, unknown>[]).slice(0, 50)

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
            } else if (item.type === 'fleur-beta' && item.id) {
              const res = await fleurBetaApi.getResult(String(item.id))
              if ((res as Record<string, unknown>)?.scores) {
                fleurSlots[i] = {
                  ...item,
                  scores: (res as Record<string, unknown>).scores,
                  type: 'fleur-beta',
                }
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
    }, 0) +
    (paperDraws as { cards?: unknown[] }[]).reduce((acc, r) => {
      const cards = (r.cards as unknown[]) ?? []
      return acc + (Array.isArray(cards) ? cards.length : 0)
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
    readings_count: (readings as unknown[]).length + (paperDraws as unknown[]).length,
    paper_draw_count: (paperDraws as unknown[]).length,
    dreamscape_count: (dreamscapeItems as unknown[]).length,
  }

  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

  const chronicle: Array<Record<string, unknown>> = []

  function scoresTo01(scores: Record<string, number> | undefined, maxScale = 5) {
    if (!scores) return {} as Record<string, number>
    const out: Record<string, number> = {}
    for (const p of PETAL_IDS) {
      out[p] = Math.min(1, Math.max(0, (scores[p] ?? 0) / maxScale))
    }
    return out
  }

  for (const s of sessions as Record<string, unknown>[]) {
    const plan = (s.step_data as Record<string, unknown>)?.plan14j ?? s.plan14j
    const planSynthesis =
      (plan as Record<string, unknown>)?.synthesis || (plan as Record<string, unknown>)?.synthesis_suggestion
    const anchors = (s.anchors ?? []) as Array<{ synthesis?: string }>
    const anchorSynthesis = [...anchors]
      .reverse()
      .find((a) => typeof a?.synthesis === 'string' && a.synthesis.trim())?.synthesis

    // Une seule entrée "Session" par session : on préfère la synthèse finale (plan14j),
    // sinon la dernière synthèse d'ancre disponible.
    const synthesis = planSynthesis || anchorSynthesis
    if (!synthesis) continue

    const line = buildSessionChronicleSummary(String(synthesis), s.first_words as string | undefined)
    chronicle.push({
      type: 'session',
      id: s.id,
      synthesis: line,
      created_at: s.created_at,
      tone: inferChronicleTone('session', line),
    })
  }
  for (const r of readings as Record<string, unknown>[]) {
    const line = buildReadingChronicleSummary(r)
    if (line) {
      chronicle.push({
        type: 'tirage',
        id: r.id,
        synthesis: line,
        created_at: r.createdAt,
        tone: inferChronicleTone('tirage', line),
      })
    }
  }
  for (const r of paperDraws as Record<string, unknown>[]) {
    const line = buildPaperDrawChronicleSummary(r)
    if (line) {
      chronicle.push({
        type: 'paper_draw',
        id: r.id,
        synthesis: line,
        created_at: r.createdAt ?? r.created_at,
        tone: inferChronicleTone('paper_draw', line),
      })
    }
  }
  for (const d of dreamscapeItems as Record<string, unknown>[]) {
    const line = buildDreamscapeChronicleSummary(d)
    chronicle.push({
      type: 'dreamscape',
      id: d.id,
      synthesis: line,
      created_at: d.savedAt,
      tone: inferChronicleTone('dreamscape', line),
    })
  }
  for (const fr of fleurResultsWithScores) {
    const line = buildFleurChronicleSummary(fr)
    chronicle.push({
      type: fr.type === 'duo' ? 'fleur_duo' : fr.type === 'fleur-beta' ? 'fleur_beta' : 'fleur',
      id: fr.id,
      token: fr.token,
      synthesis: line,
      created_at: fr.created_at,
      tone: 'neutral',
    })
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
  for (const r of paperDraws as Record<string, unknown>[]) {
    const cards = (r.cards as Array<{ name?: string }> | undefined) ?? []
    for (const c of cards) {
      const name = c?.name
      if (name && CARD_TO_PETAL[name]) {
        petalsAggregate[CARD_TO_PETAL[name]] += 0.35
        petalsCount++
      }
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
    if (!p || typeof p !== 'object') continue
    const normalized: Record<string, number> = {}
    PETAL_IDS.forEach((id) => {
      normalized[id] = Math.min(1, Math.max(0, p[id] ?? 0))
    })
    const summary = sessionTimelineSummary(s)
    timeline.push({
      id: s.id,
      date: s.created_at,
      label: shortTimelineLabel(summary, 'Session', 56),
      summary: summary || undefined,
      petals: normalized,
      type: 'session',
    })
  }
  for (const r of readings as Record<string, unknown>[]) {
    const petals = readingPetals01(r)
    if (!petals) continue
    const summary = buildReadingChronicleSummary(r)
    if (!summary) continue
    timeline.push({
      id: r.id,
      date: r.createdAt ?? r.created_at,
      label: shortTimelineLabel(summary, 'Tirage', 56),
      summary,
      petals,
      type: 'tirage',
    })
  }
  for (const r of paperDraws as Record<string, unknown>[]) {
    const petals = paperDrawPetals01(r)
    const summary = buildPaperDrawChronicleSummary(r)
    if (!summary) continue
    timeline.push({
      id: r.id,
      date: r.createdAt ?? r.created_at,
      label: shortTimelineLabel(summary, 'Tirage papier', 56),
      summary,
      petals: petals ?? Object.fromEntries(PETAL_IDS.map((id) => [id, 0])),
      type: 'paper_draw',
    })
  }
  for (const fr of fleurResultsWithScores) {
    const scores = fr.scores as Record<string, number> | undefined
    if (scores) {
      const p01 = scoresTo01(scores)
      const summary =
        fr.type === 'duo'
          ? 'Exploration Fleur DUO — profil relationnel à deux'
          : 'Exploration Ma Fleur — questionnaire des huit pétales'
      timeline.push({
        id: fr.id,
        date: fr.created_at,
        label: fr.type === 'duo' ? 'Fleur DUO' : 'Ma Fleur',
        summary,
        petals: p01,
        type: 'fleur',
      })
    }
  }
  for (const d of dreamscapeItems as Record<string, unknown>[]) {
    const p = d.petals as Record<string, number> | undefined
    if (!p || typeof p !== 'object') continue
    const normalized: Record<string, number> = {}
    PETAL_IDS.forEach((id) => {
      normalized[id] = Math.min(1, Math.max(0, p[id] ?? 0))
    })
    const summary = buildDreamscapeChronicleSummary(d, 520)
    timeline.push({
      id: d.id,
      date: d.savedAt,
      label: shortTimelineLabel(summary, 'Conversation intérieure', 56),
      summary,
      petals: normalized,
      type: 'dreamscape',
    })
  }
  timeline.sort((a, b) => new Date((b.date as string) || 0).getTime() - new Date((a.date as string) || 0).getTime())

  const last5Snapshots = timeline.slice(0, TIMELINE_SNAPSHOT_MAX)
  const sessionMantra = extractSessionMantra((sessions as Record<string, unknown>[])[0])

  const petals_deficit_aggregate = aggregateSessionDeficits(sessions as Record<string, unknown>[])
  const shadowZones = detectShadowZones({
    petals: petals_aggregate,
    deficits: petals_deficit_aggregate,
    chronicleShadowPetals: chronicleShadowPetals(chronicle),
  })
  const hasChronicleShadow = chronicle.slice(0, 6).some((c) => c.tone === 'shadow')

  return {
    stats,
    sessions,
    fleurResults: fleurResultsWithScores,
    fleurItems,
    readings,
    paperDraws,
    chronicle: chronicle.slice(0, CHRONICLE_MAX),
    access,
    petals_aggregate,
    petals_avg_30d,
    petals_deficit_aggregate,
    shadowZones,
    hasChronicleShadow,
    currentSession: (sessions as Record<string, unknown>[])[0] || null,
    timeline,
    last5Snapshots,
    prairieFleurs,
    prairieLinks,
    prairieMeFleur,
    sessionMantra,
  }
  } catch (err) {
    console.error('fetchDashboardData error:', err)
    return {
      stats: EMPTY_STATS,
      sessions: [],
      fleurResults: [],
      fleurItems: [],
      readings: [],
      paperDraws: [],
      chronicle: [],
      access: null,
      petals_aggregate: {} as Record<string, number>,
      petals_avg_30d: {} as Record<string, number>,
      petals_deficit_aggregate: {} as Record<string, number>,
      shadowZones: [],
      hasChronicleShadow: false,
      currentSession: null,
      timeline: [],
      last5Snapshots: [],
      prairieFleurs: [],
      prairieLinks: [],
      prairieMeFleur: null,
      sessionMantra: null,
    }
  }
}

export type ZenBrief = {
  headline: string
  profile: string
  aspirations: string
  movement: string
}

/** @deprecated champs legacy portrait seul */
export type ZenBriefLegacy = {
  headline: string
  portrait?: string
  profile?: string
  aspirations?: string
  movement: string
}

export const dashboardApi = {
  fetchData: fetchDashboardData,
  getZenBrief: (locale = 'fr') =>
    api.post('/api/ai/zen-brief', { locale }) as Promise<{ brief: ZenBrief; cached: boolean }>,
  getInsight: (petals: Record<string, number>, locale = 'fr') =>
    api.post('/api/ai/dashboard-insight', { petals, locale }),
  getTrend: (snapshots: unknown[]) => api.post('/api/ai/dashboard-trend', { snapshots }),
  getFlowerStateHaiku: (body: {
    mode: 'blend' | 'snapshot'
    petals: Record<string, number>
    locale: string
    cacheKey: string
    snapshotMeta?: { dateIso?: string; type?: string; label?: string }
  }) => api.post('/api/ai/flower-state-haiku', body),
}
