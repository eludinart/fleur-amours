/**
 * Écho du jour — contexte, suggestions personnalisées et normalisation des réponses IA.
 */
import { authMe } from './db-auth'
import { getBaseline } from './db-baseline'
import { getMyCheckins, getTodayCheckin, type Checkin } from './db-checkins'
import { my as dreamscapeMy } from './db-dreamscape'
import { myPaperDraws } from './db-paper-draw'
import { listByEmailForTimeline } from './db-sessions'
import { my as tarotMy } from './db-tarot'
import { isSessionMantraEcho } from './session-mantra-echo'
import { resolveUserPetalsProfile } from './resolve-user-petals'
import { dominantPetalId, topPetalIds } from './petal-tarot'
import {
  aggregateSessionDeficits,
  detectShadowZones,
  weakProfilePetals,
} from './petal-shadow'
import { PETAL_BY_ID, PETAL_ORDER_IDS } from './petal-theme'

export type CheckinEchoResponse = {
  echo: string
  highlight_petal: string
  invitation: string
  whisper: string
  provider?: string
}

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

const PETAL_LABELS_FR: Record<string, string> = {
  agape: 'Agapè',
  philautia: 'Philautia',
  mania: 'Mania',
  storge: 'Storgè',
  pragma: 'Pragma',
  philia: 'Philia',
  ludus: 'Ludus',
  eros: 'Éros',
}

const PETAL_INTENT_FR: Record<string, string> = {
  agape: "Comment accueillir une forme d'amour plus inconditionnelle dans ce que je vis en ce moment ?",
  philautia: "Qu'est-ce qui nourrit ou fragilise ma relation à moi-même aujourd'hui ?",
  mania: "Où la fusion ou l'exigence colorent-elles mes attachements — que puis-je reconnaître ?",
  storge: "Quels liens de confiance ou de tendresse veulent être honorés aujourd'hui ?",
  pragma: 'Quelle structure ou clarté manque-t-il pour que les choses avancent sainement ?',
  philia: "Qu'est-ce que l'amitié ou la complicité m'invite à voir aujourd'hui ?",
  ludus: "Où le jeu ou la légèreté pourraient-ils redonner de l'air à mon histoire ?",
  eros: 'Quel désir ou quelle passion cherche à se dire aujourd\'hui ?',
}

const PETAL_INTENT_EN: Record<string, string> = {
  agape: 'How can I welcome a more unconditional love in what I am living right now?',
  philautia: 'What nourishes or weakens my relationship with myself today?',
  mania: 'Where do fusion or demand color my attachments — what can I recognize?',
  storge: 'Which bonds of trust or tenderness want to be honored today?',
  pragma: 'What structure or clarity is missing for things to move forward healthily?',
  philia: 'What does friendship or complicity invite me to see today?',
  ludus: 'Where could play or lightness give my story more breathing room?',
  eros: 'What desire or passion is trying to speak today?',
}

function isEn(locale: string): boolean {
  return locale.toLowerCase().startsWith('en')
}

export function petalLabel(petalId: string, locale: string): string {
  return PETAL_BY_ID[petalId]?.name ?? PETAL_LABELS_FR[petalId] ?? petalId
}

export function petalIntent(petalId: string, locale: string): string {
  const map = isEn(locale) ? PETAL_INTENT_EN : PETAL_INTENT_FR
  return map[petalId] ?? map.philautia
}

export function isValidPetalId(id: string): boolean {
  return PETAL_ORDER_IDS.includes(id)
}

/** Filtre intentions trop courtes, placeholders ou texte de test. */
export function isMeaningfulIntention(text: string | null | undefined): boolean {
  if (text == null) return false
  const t = String(text).trim()
  if (t.length < 12) return false
  if (isSessionMantraEcho(t)) return false
  if (/^(blabla|test|aaa+|xxx+|foo|bar|asdf|qwerty)$/i.test(t)) return false
  if (!/[a-zàâäéèêëïîôùûüç]/i.test(t)) return false
  return true
}

function primaryCardName(r: Record<string, unknown>): string | null {
  const card = r.card as { name?: string } | undefined
  if (card?.name) return card.name
  const cards = r.cards as Array<{ name?: string }> | undefined
  return cards?.[0]?.name ?? null
}

function cardToPetal(cardName: string | null | undefined): string | null {
  if (!cardName) return null
  const pid = CARD_TO_PETAL[cardName]
  return pid && isValidPetalId(pid) ? pid : null
}

function readingPetalHits(readings: Array<Record<string, unknown>>): Record<string, number> {
  const hits = Object.fromEntries(PETAL_ORDER_IDS.map((id) => [id, 0])) as Record<string, number>
  for (const r of readings.slice(0, 20)) {
    const names: string[] = []
    const type = String(r.type ?? 'simple')
    if (type === 'four' && Array.isArray(r.cards)) {
      for (const c of r.cards as Array<{ name?: string }>) {
        if (c?.name) names.push(c.name)
      }
    } else {
      const n = primaryCardName(r)
      if (n) names.push(n)
    }
    const petals = new Set<string>()
    for (const name of names) {
      const pid = cardToPetal(name)
      if (pid) petals.add(pid)
    }
    for (const pid of petals) hits[pid] += 1
  }
  return hits
}

export function normalizeCheckinEcho(raw: unknown, locale: string): CheckinEchoResponse | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const echo = String(r.echo ?? r.phrase ?? r.reflection ?? '').trim()
  let highlight = String(r.highlight_petal ?? r.petal ?? r.explore_petal ?? '').trim().toLowerCase()
  if (!isValidPetalId(highlight)) {
    const first = PETAL_ORDER_IDS.find((id) => echo.toLowerCase().includes(petalLabel(id, locale).toLowerCase()))
    highlight = first ?? 'philautia'
  }
  const invitation = String(r.invitation ?? r.question ?? r.open_question ?? '').trim()
  const whisper = String(r.whisper ?? '').trim() || echo.split(/[.!?]/)[0]?.trim().slice(0, 120) || echo.slice(0, 120)
  if (!echo) return null
  return { echo, highlight_petal: highlight, invitation, whisper }
}

export function fallbackCheckinEcho(intention: string, locale: string, petalId?: string | null): CheckinEchoResponse {
  const pid = petalId && isValidPetalId(petalId) ? petalId : 'philautia'
  const name = petalLabel(pid, locale)
  const en = isEn(locale)
  const trimmed = intention.trim()
  if (en) {
    return {
      echo: trimmed
        ? `Something in your words resonates with ${name} today — as if this dimension of love were listening more closely than the others.`
        : `${name} is gently present today, inviting you to notice what is alive in you without forcing an answer.`,
      highlight_petal: pid,
      invitation: 'What small gesture could honor this inner movement before tonight?',
      whisper: trimmed ? trimmed.slice(0, 120) : `${name} whispers softly`,
    }
  }
  return {
    echo: trimmed
      ? `Quelque chose dans vos mots résonne avec ${name} aujourd'hui — comme si cette facette de l'amour écoutait un peu plus fort que les autres.`
      : `${name} est doucement présent aujourd'hui, vous invitant à remarquer ce qui est vivant en vous sans forcer de réponse.`,
    highlight_petal: pid,
    invitation: 'Quel petit geste pourrait honorer ce mouvement intérieur avant ce soir ?',
    whisper: trimmed ? trimmed.slice(0, 120) : `${name} murmure doucement`,
  }
}

export type CheckinSuggestion = {
  kind: 'petal' | 'baseline' | 'followup' | 'reading' | 'session' | 'shadow' | 'jardin' | 'paper'
  petalId?: string
  text: string
}

type ScoredSuggestion = CheckinSuggestion & { score: number }

function weavePetalWithCard(petalId: string, cardName: string | null, locale: string): string {
  const base = petalIntent(petalId, locale)
  if (!cardName) return base
  const en = isEn(locale)
  if (en) {
    return `Your draw on « ${cardName} » — ${base.charAt(0).toLowerCase()}${base.slice(1)}`
  }
  return `Votre tirage « ${cardName} » — ${base.charAt(0).toLowerCase()}${base.slice(1)}`
}

function shadowSuggestion(petalId: string, locale: string): string {
  const name = petalLabel(petalId, locale)
  const en = isEn(locale)
  if (en) {
    return `Your recent explorations barely touch ${name} — what is asking for care in that dimension today?`
  }
  return `Vos explorations récentes éclairent peu ${name} — qu'est-ce qui demande de l'attention dans cette facette aujourd'hui ?`
}

function buildPersonalizedSuggestions(params: {
  locale: string
  petals: Record<string, number>
  readings: Array<Record<string, unknown>>
  paperDraws: Array<Record<string, unknown>>
  sessions: Array<Record<string, unknown>>
  baselineIntention: string | null
  jardinIntention: string | null
  lastEcho: Checkin | null
}): CheckinSuggestion[] {
  const { locale, petals, readings, paperDraws, sessions, baselineIntention, jardinIntention, lastEcho } = params
  const en = isEn(locale)
  const scored: ScoredSuggestion[] = []
  const seen = new Set<string>()

  const add = (s: CheckinSuggestion & { score: number }) => {
    const key = s.text.trim().toLowerCase().slice(0, 100)
    if (seen.has(key) || !isMeaningfulIntention(s.text)) return
    seen.add(key)
    scored.push(s)
  }

  // 1. Dernière intention de tirage numérique (la plus personnelle — clic direct)
  for (const r of readings.slice(0, 5)) {
    const intention = String(r.intention ?? '').trim()
    if (!isMeaningfulIntention(intention)) continue
    const card = primaryCardName(r)
    const petalId = cardToPetal(card) ?? dominantPetalId(petals) ?? undefined
    add({
      kind: 'reading',
      petalId,
      text: intention,
      score: 100 - readings.indexOf(r) * 3,
    })
    break
  }

  // 2. Fil rouge depuis le dernier écho
  const prevPetal = lastEcho?.highlightPetal
  if (prevPetal && isValidPetalId(prevPetal)) {
    const name = petalLabel(prevPetal, locale)
    const prevIntent = lastEcho?.intention?.trim()
    if (isMeaningfulIntention(prevIntent)) {
      add({
        kind: 'followup',
        petalId: prevPetal,
        text: en
          ? `Picking up your last echo on ${name}: « ${prevIntent!.slice(0, 160)} » — what has moved since?`
          : `Reprendre votre écho sur ${name} : « ${prevIntent!.slice(0, 160)} » — qu'est-ce qui a bougé depuis ?`,
        score: 96,
      })
    } else {
      add({
        kind: 'followup',
        petalId: prevPetal,
        text: en
          ? `Last time, ${name} was in the foreground. What has shifted since then?`
          : `La dernière fois, ${name} était au premier plan. Qu'est-ce qui a bougé depuis ?`,
        score: 88,
      })
    }
  }

  // 3. Premiers mots de session récente
  for (const s of sessions.slice(0, 3)) {
    const fw = String(s.first_words ?? '').trim()
    if (!isMeaningfulIntention(fw)) continue
    const door = String(s.door_suggested ?? '').trim()
    const petalFromSession = dominantPetalId(s.petals as Record<string, number> | undefined)
    add({
      kind: 'session',
      petalId: petalFromSession ?? undefined,
      text: door
        ? en
          ? `From your session (${door}): « ${fw.slice(0, 180)} »`
          : `Depuis votre session (${door}) : « ${fw.slice(0, 180)} »`
        : fw,
      score: 90 - sessions.indexOf(s) * 4,
    })
    break
  }

  // 4. Intention tirage papier
  for (const p of paperDraws.slice(0, 3)) {
    const intention = String(p.intention ?? '').trim()
    if (!isMeaningfulIntention(intention)) continue
    add({
      kind: 'paper',
      text: intention,
      score: 85 - paperDraws.indexOf(p) * 3,
    })
    break
  }

  // 5. Intention jardin (profil)
  if (isMeaningfulIntention(jardinIntention)) {
    add({ kind: 'jardin', text: jardinIntention!, score: 82 })
  }

  // 6. Ligne de base (si sincère)
  if (isMeaningfulIntention(baselineIntention)) {
    add({ kind: 'baseline', text: baselineIntention!, score: 78 })
  }

  // 7. Pétale en tension / ombre — question contextualisée
  const deficits = aggregateSessionDeficits(sessions)
  const shadowZones = detectShadowZones({ petals, deficits })
  const weak = weakProfilePetals(petals)
  const readingHits = readingPetalHits(readings)
  const underexplored = PETAL_ORDER_IDS.map((id) => ({
    id,
    weight: (weak.includes(id) ? 2 : 0) + (shadowZones.some((z) => z.petalId === id) ? 2 : 0) - readingHits[id] * 0.5,
  }))
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight)

  if (underexplored[0]) {
    add({
      kind: 'shadow',
      petalId: underexplored[0].id,
      text: shadowSuggestion(underexplored[0].id, locale),
      score: 72,
    })
  }

  // 8. Pétales dominants — tissés avec la dernière carte tirée
  const lastCard = readings.length ? primaryCardName(readings[0]) : null
  const dom = dominantPetalId(petals)
  const second = topPetalIds(petals, 3, 0.04).find((id) => id !== dom)

  if (dom) {
    add({
      kind: 'petal',
      petalId: dom,
      text: weavePetalWithCard(dom, lastCard, locale),
      score: 58,
    })
  }
  if (second) {
    add({
      kind: 'petal',
      petalId: second,
      text: petalIntent(second, locale),
      score: 45,
    })
  }

  // 9. Pétale le plus tiré récemment (si différent du dominant profil)
  const topDrawn = Object.entries(readingHits)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0]
  if (topDrawn && topDrawn !== dom && topDrawn !== second) {
    add({
      kind: 'reading',
      petalId: topDrawn,
      text: en
        ? `${petalLabel(topDrawn, locale)} keeps returning in your draws — ${petalIntent(topDrawn, locale).charAt(0).toLowerCase()}${petalIntent(topDrawn, locale).slice(1)}`
        : `${petalLabel(topDrawn, locale)} revient souvent dans vos tirages — ${petalIntent(topDrawn, locale).charAt(0).toLowerCase()}${petalIntent(topDrawn, locale).slice(1)}`,
      score: 52,
    })
  }

  // Compléter jusqu'à 3 sans doublons de pétale si possible
  scored.sort((a, b) => b.score - a.score)
  const out: CheckinSuggestion[] = []
  const usedPetals = new Set<string>()
  for (const s of scored) {
    if (out.length >= 3) break
    if (s.petalId && usedPetals.has(s.petalId) && s.kind === 'petal') continue
    if (s.petalId) usedPetals.add(s.petalId)
    out.push({ kind: s.kind, petalId: s.petalId, text: s.text })
  }

  // Filet de sécurité : intentions pétales génériques (jamais de texte vide / blabla)
  for (const id of ['philautia', 'storge', 'pragma', 'agape', 'eros'] as const) {
    if (out.length >= 3) break
    if (usedPetals.has(id)) continue
    out.push({ kind: 'petal', petalId: id, text: petalIntent(id, locale) })
    usedPetals.add(id)
  }

  return out.slice(0, 3)
}

export async function buildCheckinContext(userId: number, email: string | null, locale: string) {
  const userEmail =
    email?.trim() ||
    (await authMe(userId).catch(() => null))?.email?.trim() ||
    ''

  const [petals, baseline, checkins, readingsRes, paperRes, sessionsRes, me] = await Promise.all([
    resolveUserPetalsProfile(userId, email),
    getBaseline(userId),
    getMyCheckins(userId, 8),
    tarotMy(String(userId), userEmail || null),
    myPaperDraws(String(userId)),
    userEmail ? listByEmailForTimeline(userEmail, 8) : Promise.resolve({ items: [] as Record<string, unknown>[] }),
    authMe(userId).catch(() => null),
  ])

  const readings = readingsRes.items as Array<Record<string, unknown>>
  const paperDraws = paperRes.items as Array<Record<string, unknown>>
  const sessions = sessionsRes.items as Array<Record<string, unknown>>
  const jardinIntention = me?.jardin_intention ? String(me.jardin_intention) : null

  const lastEcho = checkins.find((c) => c.intention || c.aiResponse) ?? null

  const suggestions = buildPersonalizedSuggestions({
    locale,
    petals: petals ?? {},
    readings,
    paperDraws,
    sessions,
    baselineIntention: baseline?.intention?.trim() ?? null,
    jardinIntention,
    lastEcho,
  })

  const todayCheckin = await getTodayCheckin(userId)
  const checkedInToday = todayCheckin != null

  function toEchoView(c: Checkin) {
    return {
      whisper: c.aiResponse?.whisper ?? c.note ?? c.intention,
      highlightPetal: c.highlightPetal,
      echo: c.aiResponse?.echo ?? null,
      invitation: c.aiResponse?.invitation ?? null,
      intention: c.intention,
      createdAt: c.createdAt,
    }
  }

  return {
    petals: petals ?? {},
    suggestions: checkedInToday ? [] : suggestions,
    lastEcho: lastEcho ? toEchoView(lastEcho) : null,
    todayEcho: todayCheckin ? toEchoView(todayCheckin) : null,
    checkedInToday,
  }
}

export function parseStoredAiResponse(raw: string | null): CheckinEchoResponse | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CheckinEchoResponse
    if (parsed?.echo && parsed?.highlight_petal) return parsed
    return null
  } catch {
    return null
  }
}

export function highlightPetalToArray(petalId: string): number[] | null {
  if (!isValidPetalId(petalId)) return null
  return PETAL_ORDER_IDS.map((id) => (id === petalId ? 0.9 : 0.15))
}

export type { Checkin }
