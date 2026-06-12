/**
 * Synchronise la timeline Éclosion depuis toutes les sources persistées
 * (sessions, tirages, explorations Fleur, promenades, check-ins, diagnostic…).
 * Idempotent via recordTimelineEvent (user + source + ref_id).
 */
import { authMe } from './db-auth'
import { getBaseline } from './db-baseline'
import { getMyCheckins } from './db-checkins'
import { my as dreamscapeMy } from './db-dreamscape'
import { getMyDyad, listDyadEvents, listRituals } from './db-dyads'
import { getMyResults } from './db-fleur'
import { listFleurBetaResults } from './db-fleur-beta'
import { listByEmailForTimeline } from './db-sessions'
import { my as tarotMy } from './db-tarot'
import { recordTimelineEvent } from './db-timeline'
import { isDbConfigured } from './db'
import { PETAL_ORDER_IDS } from './petal-theme'
import {
  buildDreamscapeChronicleSummary,
  buildReadingChronicleSummary,
  buildSessionChronicleSummary,
} from './chronicle-summary'

function petalsObjectToArray(petals: Record<string, number> | undefined): number[] | null {
  if (!petals || typeof petals !== 'object') return null
  return PETAL_ORDER_IDS.map((id) => Math.min(1, Math.max(0, Number(petals[id]) || 0)))
}

function scoresToPetalsArray(scores: Record<string, number> | undefined, maxScale = 5): number[] | null {
  if (!scores || typeof scores !== 'object') return null
  return PETAL_ORDER_IDS.map((id) => {
    const v = Number(scores[id]) || 0
    return Math.min(1, Math.max(0, v / maxScale))
  })
}

function sessionSummary(s: Record<string, unknown>): string | null {
  const stepData = s.step_data as Record<string, unknown> | undefined
  const plan = (stepData?.plan14j ?? s.plan14j) as Record<string, unknown> | null
  const planSyn = plan?.synthesis ?? plan?.synthesis_suggestion
  const anchors = (s.anchors ?? []) as Array<{ synthesis?: string }>
  const anchorSyn = [...anchors]
    .reverse()
    .find((a) => typeof a?.synthesis === 'string' && a.synthesis.trim())?.synthesis
  const synthesis = planSyn || anchorSyn
  if (synthesis) {
    const line = buildSessionChronicleSummary(
      String(synthesis),
      s.first_words as string | undefined
    )
    if (line) return line.slice(0, 280)
  }
  const fw = typeof s.first_words === 'string' ? s.first_words.trim() : ''
  return fw ? fw.slice(0, 280) : null
}

const DIAG_PORTE_LABEL: Record<string, string> = {
  love: 'Amour',
  vegetal: 'Végétal',
  elements: 'Éléments',
  life: 'Vie',
}

/**
 * Réimporte l'historique utilisateur dans fleur_timeline_events.
 * Appelé avant lecture timeline (GET /api/timeline/my).
 */
export async function syncUserTimeline(userId: number, email?: string | null): Promise<void> {
  if (!isDbConfigured() || !Number.isFinite(userId) || userId <= 0) return

  const userEmail =
    email?.trim() ||
    (await authMe(userId).catch(() => null))?.email?.trim() ||
    ''

  const tasks: Promise<unknown>[] = []

  if (userEmail) {
    const { items: sessions } = await listByEmailForTimeline(userEmail, 200)
    for (const s of sessions) {
      const id = Number(s.id)
      if (!id) continue
      const door = String(s.door_suggested ?? '').trim()
      tasks.push(
        recordTimelineEvent({
          userId,
          source: 'session',
          refId: id,
          title: door || 'Session guidée',
          summary: sessionSummary(s),
          petals: petalsObjectToArray(s.petals as Record<string, number>),
          occurredAt: s.created_at as string,
        })
      )
    }
  }

  const { items: readings } = await tarotMy(String(userId), userEmail || null)
  for (const r of readings) {
    const id = parseInt(String(r.id ?? 0), 10)
    if (!id) continue
    const type = String(r.type ?? 'simple')
      tasks.push(
        recordTimelineEvent({
          userId,
          source: 'tirage',
          refId: id,
          title: type === 'four' ? 'Tirage des 4 Portes' : 'Tirage de carte',
          summary: buildReadingChronicleSummary(r)?.slice(0, 280) || null,
          occurredAt: (r.createdAt ?? r.created_at) as string,
        })
      )
  }

  const { items: fleurItems } = await getMyResults(String(userId))
  for (const fr of fleurItems) {
    const id = Number(fr.id)
    if (!id) continue
    const isDuo = fr.type === 'duo'
    const status = String(fr.status ?? '')
    const title = isDuo
      ? status === 'waiting_partner'
        ? 'Exploration Fleur DUO (en attente)'
        : 'Exploration Fleur DUO'
      : 'Exploration Ma Fleur'
      tasks.push(
        recordTimelineEvent({
          userId,
          source: 'fleur',
          refId: id,
          title,
          summary: null,
          petals: scoresToPetalsArray(fr.scores as Record<string, number>),
          occurredAt: fr.created_at as string,
        })
      )
  }

  const betaRows = await listFleurBetaResults(userId)
  for (const b of betaRows) {
    const porte = DIAG_PORTE_LABEL[b.porte] ?? b.porte
      tasks.push(
        recordTimelineEvent({
          userId,
          source: 'diagnostic',
          refId: b.id,
          title: `Questionnaire — ${porte}`,
          summary: b.questionnaire_version ? `Version ${b.questionnaire_version}` : null,
          occurredAt: b.created_at,
        })
      )
  }

  const { items: dreamscapes } = await dreamscapeMy(String(userId))
  for (const d of dreamscapes) {
    const id = Number(d.id)
    if (!id) continue
      tasks.push(
        recordTimelineEvent({
          userId,
          source: 'dreamscape',
          refId: id,
          title: 'Promenade onirique',
          summary: buildDreamscapeChronicleSummary(d).slice(0, 280),
          petals: petalsObjectToArray(d.petals as Record<string, number>),
          occurredAt: d.savedAt as string,
        })
      )
  }

  const checkins = await getMyCheckins(userId, 100)
  for (const c of checkins) {
      tasks.push(
        recordTimelineEvent({
          userId,
          source: 'checkin',
          refId: c.id,
          title: 'Check-in',
          summary: c.note ? String(c.note).slice(0, 280) : null,
          mood: c.mood,
          occurredAt: c.createdAt,
        })
      )
  }

  const baseline = await getBaseline(userId)
  if (baseline) {
      tasks.push(
        recordTimelineEvent({
          userId,
          source: 'onboarding',
          refId: userId,
          title: 'Ligne de base',
          summary: baseline.intention ? String(baseline.intention).slice(0, 280) : null,
          petals: PETAL_ORDER_IDS.map((id) => baseline.petals[id] ?? 0),
          occurredAt: baseline.createdAt,
        })
      )
  }

  const dyad = await getMyDyad(userId)
  if (dyad) {
    const events = await listDyadEvents(dyad.id, 100)
    for (const ev of events) {
      if (ev.type === 'message') continue
      tasks.push(
        recordTimelineEvent({
          userId,
          source: 'dyad',
          refId: ev.id,
          title: ev.type === 'ritual' ? 'Rituel relationnel' : 'Échange en dyade',
          summary: ev.content ? String(ev.content).slice(0, 280) : null,
          occurredAt: ev.createdAt,
        })
      )
    }
    const rituals = await listRituals(dyad.id)
    for (const r of rituals) {
      if (!r.lastDoneAt) continue
      tasks.push(
        recordTimelineEvent({
          userId,
          source: 'ritual',
          refId: r.id,
          title: r.title || 'Rituel relationnel',
          summary: null,
          occurredAt: r.lastDoneAt,
        })
      )
    }
  }

  await Promise.all(tasks.map((p) => p.catch(() => {})))
}
