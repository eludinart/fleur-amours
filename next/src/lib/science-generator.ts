import { openrouterCall } from './openrouter'
import { getLangInstruction } from './prompts'
import { getScienceConfig, getScienceEvidence, getScienceProfile, upsertScienceEvidence, upsertScienceProfile } from './science-db'
import { getMyConversations, getMessages } from './db-chat'
import { getChannelMessages, getChannelMessagesSince, getChannelLastMessageAt, getMyChannels } from './db-social'
import { my as myDreamscapes } from './db-dreamscape'
import { my as myTarotReadings } from './db-tarot'
import { my as mySessions } from './db-sessions'
import { getMyResults, getResult, getDuoResult } from './db-fleur'

type ScienceAIOutput = {
  facts: Array<{
    id: string
    text: string
    confidence: number
    confidence_label: 'high' | 'medium' | 'low'
    perimeter: string
    evidence_refs: string[]
    can_be_hidden: boolean
  }>
  hypotheses: Array<{
    id: string
    text: string
    confidence: number
    confidence_label: 'high' | 'medium' | 'low'
    perimeter: string
    evidence_refs: string[]
    can_be_hidden: boolean
  }>
  meta: {
    config_version: string
    evidence_sources: string[]
    has_chat_context: boolean
    evidence_item_count: number
    generation_version: string
  }
}

const PETAL_IDS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const
type PetalId = (typeof PETAL_IDS)[number]

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function safeLocale(locale: string): 'fr' | 'en' | 'es' {
  const l = String(locale ?? '').toLowerCase()
  if (l === 'en' || l === 'es' || l === 'fr') return l
  return 'fr'
}

function confidenceLabel(config: {
  confidence_min_facts: number
  confidence_low_max: number
  confidence_medium_max: number
}): (c: number) => 'high' | 'medium' | 'low' {
  return (c: number) => {
    const x = clamp01(c)
    if (x >= config.confidence_min_facts) return 'high'
    if (x <= config.confidence_low_max) return 'low'
    if (x <= config.confidence_medium_max) return 'medium'
    // Cas limite (ex: config incohérente) : on considère medium plutôt que low.
    return 'medium'
  }
}

async function extractResumeAndTags(params: {
  locale: string
  previousResume?: string
  messagesText: string
}): Promise<{ resume_text: string; tags: PetalId[] } | null> {
  // NOTE: A) extraction "résumé conversationnel + tags"
  // tags: uniquement parmi les IDs de pétales (pour qu'on puisse mapper sans inférer trop).
  const sys = `Tu es le Tuteur maïeutique du jardin intérieur.
Objectif : à partir d'un extrait de conversation (échanges et émotions, sans diagnostic), produire une synthèse non-directive et des tags.

Règles de sortie :
- tags UNIQUEMENT parmi la liste suivante :
  ["agape","philautia","mania","storge","pragma","philia","ludus","eros"]
- tags doit contenir 0 à 4 éléments.
- resume_text : 4 à 8 phrases, dans la langue demandée, exprimé avec douceur et précision, sans conseil direct.
- Réponds UNIQUEMENT en JSON strict :
  {"resume_text":"...","tags":["agape", "..."] }
- Ne rajoute jamais de texte hors JSON.`

  const user = {
    content:
      `Extrait de conversation (texte brut) :
${params.messagesText}

Résumé précédent (si présent). Sinon, ignorer :
${params.previousResume ? params.previousResume : '(aucun)'}

` + getLangInstruction(safeLocale(params.locale)),
  }

  const result = await openrouterCall(
    sys,
    [{ role: 'user', content: user.content }],
    { maxTokens: 260, responseFormatJson: true }
  )

  if (!result || typeof result !== 'object') return null
  const r = result as any
  const resumeText = typeof r?.resume_text === 'string' ? r.resume_text.trim() : ''
  const tagsRaw = Array.isArray(r?.tags) ? r.tags : []
  const tags = tagsRaw
    .map((t: any) => String(t).trim().toLowerCase())
    .filter((t: string): t is PetalId => PETAL_IDS.includes(t as PetalId))

  return { resume_text: resumeText, tags }
}

function petalLabel(locale: 'fr' | 'en' | 'es'): Record<PetalId, string> {
  if (locale === 'en') {
    return {
      agape: 'Agape',
      philautia: 'Philautia',
      mania: 'Mania',
      storge: 'Storge',
      pragma: 'Pragma',
      philia: 'Philia',
      ludus: 'Ludus',
      eros: 'Eros',
    }
  }
  if (locale === 'es') {
    return {
      agape: 'Ágape',
      philautia: 'Filautia',
      mania: 'Manía',
      storge: 'Storgè',
      pragma: 'Pragma',
      philia: 'Filia',
      ludus: 'Ludus',
      eros: 'Eros',
    }
  }
  return {
    agape: 'Agapè',
    philautia: 'Philautia',
    mania: 'Mania',
    storge: 'Storgè',
    pragma: 'Pragma',
    philia: 'Philia',
    ludus: 'Ludus',
    eros: 'Éros',
  }
}

function normalizePetalTags(input: unknown): PetalId[] {
  const arr = Array.isArray(input) ? input : []
  return arr
    .map((x) => String(x ?? '').trim().toLowerCase())
    .filter((t): t is PetalId => PETAL_IDS.includes(t as PetalId))
}

export async function generateScienceProfile(params: {
  userId: number
  userEmail: string
  locale: string
  petals: Record<string, number>
  force?: boolean
}): Promise<ScienceAIOutput> {
  const { config, db_configured } = await getScienceConfig()
  const locale = safeLocale(params.locale)

  const labelFn = confidenceLabel(config)
  const names = petalLabel(locale)

  async function collectPetalsAggregateFromDB(): Promise<Record<string, number>> {
    // Reproduire l'idée de `petals_aggregate` côté serveur avec les flags admin.
    // Objectif : le score de pétales (v) ne dépend plus du client.
    const PETAL_IDS_LOCAL: PetalId[] = [...PETAL_IDS]
    const CARD_TO_PETAL_LOCAL: Record<string, string> = {
      Agapè: 'agape',
      Philautia: 'philautia',
      Mania: 'mania',
      Storgè: 'storge',
      Pragma: 'pragma',
      Philia: 'philia',
      Ludus: 'ludus',
      Éros: 'eros',
    }
    const init: Record<PetalId, number> = {
      agape: 0,
      philautia: 0,
      mania: 0,
      storge: 0,
      pragma: 0,
      philia: 0,
      ludus: 0,
      eros: 0,
    }
    const petalsAggregate: Record<PetalId, number> = { ...init }
    let petalsCount = 0

    function scoresTo01(scores: Record<string, number> | undefined, maxScale = 5) {
      if (!scores) return {} as Record<string, number>
      const out: Record<string, number> = {}
      for (const p of PETAL_IDS_LOCAL) {
        out[p] = Math.min(1, Math.max(0, (scores[p] ?? 0) / maxScale))
      }
      return out
    }

    // Fleur / Ma Fleur / Duo
    const includeSolo = config.include_solo_fleur || config.include_ma_fleur
    const includeDuo = config.include_duo
    if (includeSolo || includeDuo) {
      try {
        const fleurRes = await getMyResults(String(params.userId))
        const fleurItems = (fleurRes as any)?.items ?? []
        for (const item of (fleurItems as Array<Record<string, unknown>>).slice(0, 20)) {
          const type = String(item.type ?? '')
          if (type === 'duo') {
            if (!includeDuo) continue
            const token = String(item.token ?? '').trim()
            if (!token) continue
            const duo = await getDuoResult(token)
            const personA = duo?.person_a as any
            const scores = (personA?.scores ?? personA) as Record<string, number> | undefined
            const p01 = scoresTo01(scores, 5)
            PETAL_IDS_LOCAL.forEach((p) => {
              petalsAggregate[p] += p01[p] ?? 0
            })
            petalsCount++
          } else {
            if (!includeSolo) continue
            const id = Number(item.id ?? 0)
            if (!id) continue
            const res = await getResult(id, String(params.userId))
            const scores = (res?.scores ?? res) as Record<string, number> | undefined
            const p01 = scoresTo01(scores, 5)
            PETAL_IDS_LOCAL.forEach((p) => {
              petalsAggregate[p] += p01[p] ?? 0
            })
            petalsCount++
          }
        }
      } catch {
        // best-effort
      }
    }

    // Sessions (plan14j) — proxy principal pour l'évolution du profil
    if (config.include_petals_aggregate) {
      try {
        const sessionsRes = await mySessions(params.userEmail)
        const items = (sessionsRes as any)?.items ?? []
        for (const s of items as Array<Record<string, unknown>>) {
          const p = s?.petals as Record<string, number> | undefined
          if (!p || typeof p !== 'object') continue
          PETAL_IDS_LOCAL.forEach((id) => {
            petalsAggregate[id] += Math.min(1, Math.max(0, Number(p[id] ?? 0)))
          })
          petalsCount++
        }
      } catch {
        // best-effort
      }
    }

    // Tirages
    if (config.include_tarot_1card || config.include_tarot_4doors) {
      try {
        const readingsRes = await myTarotReadings(String(params.userId), params.userEmail)
        const items = (readingsRes as any)?.items ?? []
        for (const r of items as Array<Record<string, unknown>>) {
          const type = String(r.type ?? 'simple')
          if (type === 'four' && !config.include_tarot_4doors) continue
          if (type !== 'four' && !config.include_tarot_1card) continue

          const card = (r as any).card ?? ((r as any).cards as any[])?.[0]
          const name = card?.name ? String(card.name) : ''
          if (name && CARD_TO_PETAL_LOCAL[name]) {
            petalsAggregate[CARD_TO_PETAL_LOCAL[name] as PetalId] += 0.5
            petalsCount++
          }
        }
      } catch {
        // best-effort
      }
    }

    // Promenade onirique
    if (config.include_dreamscape) {
      try {
        const dreamRes = await myDreamscapes(String(params.userId))
        const items = (dreamRes as any)?.items ?? []
        for (const d of items as Array<Record<string, unknown>>) {
          const p = d?.petals as Record<string, number> | undefined
          if (!p || typeof p !== 'object') continue
          PETAL_IDS_LOCAL.forEach((id) => {
            petalsAggregate[id] += Math.min(1, Math.max(0, Number(p[id] ?? 0)))
          })
          petalsCount++
        }
      } catch {
        // best-effort
      }
    }

    const petalsMax = Math.max(...Object.values(petalsAggregate), 0.01)
    const petals_aggregate: Record<PetalId, number> = {} as any
    PETAL_IDS_LOCAL.forEach((p) => {
      petals_aggregate[p] = Math.min(1, petalsAggregate[p] / petalsMax)
    })
    return petals_aggregate as Record<string, number>
  }

  // Cache (si DB dispo)
  if (db_configured && !params.force) {
    const cached = await getScienceProfile(params.userId)
    if (cached?.generated_at) {
      const t = new Date(cached.generated_at).getTime()
      const ageMinutes = Number.isFinite(t) ? (Date.now() - t) / 60000 : Infinity
      const versionOk = !cached.generation_version || cached.generation_version === config.science_generation_version
      if (ageMinutes <= config.science_profile_ttl_minutes && versionOk) {
        return {
          facts: cached.facts ?? [],
          hypotheses: cached.hypotheses ?? [],
          meta: {
            config_version: 'science-db-cache',
            evidence_sources: [],
            has_chat_context: cached.meta?.has_chat_context ?? false,
            evidence_item_count: cached.meta?.evidence_item_count ?? 0,
            generation_version: cached.generation_version ?? config.science_generation_version,
          },
        }
      }
    }
  }

  const evidenceItems: Array<{
    sourceRef: string
    tags: PetalId[]
    evidenceConfidence: number
  }> = []

  const evidenceSourcesUsed: string[] = []

  // ── Clairière (P2P) ──
  if (config.include_chat_clairiere) {
    try {
      const channels = (await getMyChannels(String(params.userId))).channels ?? []
      for (const ch of channels) {
        const sourceId = String(ch.channelId)
        const cursorNow = await getChannelLastMessageAt(ch.channelId, String(params.userId))
        const existing = await getScienceEvidence({
          userId: params.userId,
          sourceType: 'chat_clairiere',
          sourceId,
          defaultPerimeter: 'chat',
        })

        const cursorPrev = existing?.cursor_last_message_at ?? null
        if (!cursorNow && cursorNow !== '' && (!existing || cursorPrev)) continue
        if (existing && cursorPrev && cursorNow && String(cursorPrev) === String(cursorNow)) continue

        let messagesText = ''
        let previousResume = existing?.resume_text ?? undefined
        let messages: Array<{ senderId: number; body: string | null; createdAt: string | undefined }> = []

        if (existing?.cursor_last_message_at && cursorNow) {
          const since = existing.cursor_last_message_at
          const updated = await getChannelMessagesSince(ch.channelId, String(params.userId), since)
          messages = updated.map((m) => ({ senderId: m.senderId, body: m.body, createdAt: m.createdAt }))
        } else {
          const all = await getChannelMessages(ch.channelId, String(params.userId))
          messages = all.map((m) => ({ senderId: m.senderId, body: m.body, createdAt: m.createdAt }))
        }

        // Keep last N messages for token economy.
        const maxN = existing ? config.evidence_update_max_messages : config.evidence_initial_max_messages
        messages = messages.slice(-maxN)

        if (messages.length === 0) continue

        messagesText = messages
          .filter((m) => (m.body ?? '').trim())
          .map((m) => {
            const who = m.senderId === params.userId ? 'Vous' : 'Autre'
            const content = String(m.body ?? '').trim()
            return `${who}: ${content}`
          })
          .join('\n')

        if (!messagesText.trim()) continue

        const extracted = await extractResumeAndTags({
          locale,
          previousResume,
          messagesText,
        })

        const tags = normalizePetalTags(extracted?.tags ?? existing?.tags ?? [])
        const resumeText = extracted?.resume_text ?? existing?.resume_text ?? ''
        const evidenceConfidence = clamp01(0.25 + 0.12 * tags.length)

        const useful = (tags?.length ?? 0) > 0 || (resumeText ?? '').trim().length > 0
        if (!useful) continue

        evidenceSourcesUsed.push('chat_clairiere')
        evidenceItems.push({ sourceRef: `clairiere:${sourceId}`, tags, evidenceConfidence })

        await upsertScienceEvidence({
          userId: params.userId,
          perimeter: 'chat',
          sourceType: 'chat_clairiere',
          sourceId,
          cursorLastMessageAt: cursorNow ?? existing?.cursor_last_message_at ?? null,
          resumeText,
          tags,
          evidenceConfidence,
        })
      }
    } catch {
      // Chat evidence is best-effort.
    }
  }

  // ── Coach chats (conversation) ──
  if (config.include_chat_coach) {
    try {
      const conversations = await getMyConversations(params.userId, params.userEmail)
      for (const conv of conversations) {
        const sourceId = String(conv.id)
        const cursorNow = conv.last_message_at ?? null
        const existing = await getScienceEvidence({
          userId: params.userId,
          sourceType: 'chat_coach',
          sourceId,
          defaultPerimeter: 'chat',
        })

        if (existing && existing.cursor_last_message_at && cursorNow && String(existing.cursor_last_message_at) === String(cursorNow)) {
          continue
        }

        let messages: Array<{ senderRole: string; content: string; createdAt: string }>
        let previousResume = existing?.resume_text ?? undefined

        if (existing?.cursor_last_message_at && cursorNow) {
          const updated = await getMessages(conv.id, existing.cursor_last_message_at)
          messages = updated.map((m) => ({ senderRole: m.sender_role, content: m.content, createdAt: m.created_at }))
        } else {
          const all = await getMessages(conv.id)
          messages = all.map((m) => ({ senderRole: m.sender_role, content: m.content, createdAt: m.created_at }))
        }

        const maxN = existing ? config.evidence_update_max_messages : config.evidence_initial_max_messages
        messages = messages.slice(-maxN)

        const messagesText = messages
          .filter((m) => (m.content ?? '').trim())
          .map((m) => {
            const who = m.senderRole === 'coach' ? 'Coach' : 'Vous'
            return `${who}: ${String(m.content ?? '').trim()}`
          })
          .join('\n')

        if (!messagesText.trim()) continue

        const extracted = await extractResumeAndTags({ locale, previousResume, messagesText })
        const tags = normalizePetalTags(extracted?.tags ?? existing?.tags ?? [])
        const resumeText = extracted?.resume_text ?? existing?.resume_text ?? ''
        const evidenceConfidence = clamp01(0.25 + 0.12 * tags.length)

        const useful = (tags?.length ?? 0) > 0 || (resumeText ?? '').trim().length > 0
        if (!useful) continue

        evidenceSourcesUsed.push('chat_coach')
        evidenceItems.push({ sourceRef: `coach_chat:${sourceId}`, tags, evidenceConfidence })

        await upsertScienceEvidence({
          userId: params.userId,
          perimeter: 'chat',
          sourceType: 'chat_coach',
          sourceId,
          cursorLastMessageAt: cursorNow,
          resumeText,
          tags,
          evidenceConfidence,
        })
      }
    } catch {
      // best-effort
    }
  }

  // ── Promenade onirique (dreamscape) ──
  if (config.include_dreamscape) {
    try {
      const dreamscapeItemsRes = await myDreamscapes(String(params.userId))
      const dreamscapeItems = (dreamscapeItemsRes as any)?.items ?? []

      let extracted = 0
      const MAX_EXTRACT = 6

      for (const item of dreamscapeItems.slice(0, 25)) {
        if (extracted >= MAX_EXTRACT) break
        const sourceId = String(item.id ?? '')
        if (!sourceId) continue

        const cursorNow = item.savedAt ? String(item.savedAt) : null
        const existing = await getScienceEvidence({
          userId: params.userId,
          sourceType: 'dreamscape',
          sourceId,
          defaultPerimeter: 'dreamscape',
        })

        const cursorPrev = existing?.cursor_last_message_at ?? null
        const cursorOk = cursorNow && cursorPrev && String(cursorNow) === String(cursorPrev)
        if (cursorOk) continue

        const history = Array.isArray(item.history) ? item.history : []
        const poetic = typeof item.poeticReflection === 'string' ? item.poeticReflection : ''

        const messagesText = history
          .map((m: any) => {
            const role = (m?.role ?? 'user') === 'closing' ? 'user' : m?.role ?? 'user'
            const content = String(m?.content ?? '').trim()
            if (!content) return ''
            return `${role === 'user' ? 'Vous' : 'IA'}: ${content}`
          })
          .filter(Boolean)
          .join('\n')

        const combinedText =
          [messagesText.trim(), poetic.trim() ? `Poétique: ${poetic.trim()}` : ''].filter(Boolean).join('\n\n') || ''

        if (!combinedText.trim()) continue

        const extractedResume = await extractResumeAndTags({
          locale,
          previousResume: existing?.resume_text,
          messagesText: combinedText,
        })

        const tags = normalizePetalTags(extractedResume?.tags ?? existing?.tags ?? [])
        const resumeText = extractedResume?.resume_text ?? existing?.resume_text ?? ''

        const useful = (tags?.length ?? 0) > 0 || (resumeText ?? '').trim().length > 0
        if (!useful) continue

        const evidenceConfidence = clamp01(0.22 + 0.12 * tags.length)

        evidenceSourcesUsed.push('dreamscape')
        evidenceItems.push({
          sourceRef: `dreamscape:${sourceId}`,
          tags,
          evidenceConfidence,
        })

        await upsertScienceEvidence({
          userId: params.userId,
          perimeter: 'dreamscape',
          sourceType: 'dreamscape',
          sourceId,
          cursorLastMessageAt: cursorNow,
          resumeText,
          tags,
          evidenceConfidence,
        })

        extracted++
      }
    } catch {
      // best-effort
    }
  }

  // ── Tirages tarot (simple/1 carte + four/4 portes) ──
  if (config.include_tarot_1card || config.include_tarot_4doors) {
    try {
      const tarotItemsRes = await myTarotReadings(String(params.userId), params.userEmail)
      const tarotItems = (tarotItemsRes as any)?.items ?? []

      let extracted = 0
      const MAX_EXTRACT = 8

      for (const item of tarotItems.slice(0, 30)) {
        if (extracted >= MAX_EXTRACT) break
        const sourceId = String(item.id ?? '')
        if (!sourceId) continue

        const type = String(item.type ?? 'simple')
        if (type === 'simple' && !config.include_tarot_1card) continue
        if (type === 'four' && !config.include_tarot_4doors) continue

        const createdAt = item.createdAt ? String(item.createdAt) : null
        const interp = typeof item.interpretation === 'string' ? item.interpretation : ''
        const synth = typeof item.synthesis === 'string' ? item.synthesis : ''
        const reflection = typeof item.reflection === 'string' ? item.reflection : ''
        const intention = typeof item.intention === 'string' ? item.intention : ''

        // Cursor : on se base sur createdAt + présence/longueur des champs “humains”
        const cursorFingerprint = `${createdAt ?? ''}|${interp.length}|${reflection.length}|${synth.length}|${intention.length}`.slice(0, 64)

        const sourceType = type === 'simple' ? 'tarot_1card' : 'tarot_4doors'
        const existing = await getScienceEvidence({
          userId: params.userId,
          sourceType,
          sourceId,
          defaultPerimeter: 'tarot',
        })

        const cursorPrev = existing?.cursor_last_message_at ?? null
        if (cursorPrev && cursorPrev === cursorFingerprint) continue

        const cardsText =
          type === 'simple'
            ? item.card
              ? `Carte: ${item.card.name ?? ''} — ${item.card.synth ?? ''}`
              : ''
            : Array.isArray(item.cards)
              ? `Cartes: ${item.cards.map((c: any) => c?.name ?? '').filter(Boolean).join(' · ')}`
              : ''

        const combinedText = [
          intention.trim() ? `Intention: ${intention.trim()}` : '',
          cardsText,
          synth.trim() ? `Synthèse: ${synth.trim()}` : '',
          interp.trim() ? `Interprétation: ${interp.trim()}` : '',
          reflection.trim() ? `Réflexion: ${reflection.trim()}` : '',
        ]
          .filter(Boolean)
          .join('\n\n')

        if (!combinedText.trim()) continue

        const extractedResume = await extractResumeAndTags({
          locale,
          previousResume: existing?.resume_text,
          messagesText: combinedText,
        })

        const tags = normalizePetalTags(extractedResume?.tags ?? existing?.tags ?? [])
        const resumeText = extractedResume?.resume_text ?? existing?.resume_text ?? ''

        const useful = (tags?.length ?? 0) > 0 || (resumeText ?? '').trim().length > 0
        if (!useful) continue

        const evidenceConfidence = clamp01(0.22 + 0.11 * tags.length)

        evidenceSourcesUsed.push(sourceType)
        evidenceItems.push({
          sourceRef: `${sourceType}:${sourceId}`,
          tags,
          evidenceConfidence,
        })

        await upsertScienceEvidence({
          userId: params.userId,
          perimeter: 'tarot',
          sourceType,
          sourceId,
          cursorLastMessageAt: cursorFingerprint,
          resumeText,
          tags,
          evidenceConfidence,
        })

        extracted++
      }
    } catch {
      // best-effort
    }
  }

  // Petals baseline (v) — côté serveur quand c’est possible.
  // On fait ça avant la construction Facts/Hypothèses.
  let petalsBaseline: Record<string, number> = params.petals ?? {}
  if (db_configured && config.include_petals_aggregate) {
    petalsBaseline = await collectPetalsAggregateFromDB()
  }

  const evidenceByPetal: Record<PetalId, { score: number; refs: string[] }> = {
    agape: { score: 0, refs: [] },
    philautia: { score: 0, refs: [] },
    mania: { score: 0, refs: [] },
    storge: { score: 0, refs: [] },
    pragma: { score: 0, refs: [] },
    philia: { score: 0, refs: [] },
    ludus: { score: 0, refs: [] },
    eros: { score: 0, refs: [] },
  }

  for (const ev of evidenceItems) {
    for (const t of ev.tags) {
      evidenceByPetal[t].score += ev.evidenceConfidence
      evidenceByPetal[t].refs.push(ev.sourceRef)
    }
  }

  const evidenceTotal = Math.max(1, evidenceItems.length)
  for (const p of PETAL_IDS) {
    evidenceByPetal[p].score = evidenceByPetal[p].score / evidenceTotal
    evidenceByPetal[p].refs = Array.from(new Set(evidenceByPetal[p].refs)).slice(0, 3)
  }

  // ── Construire Facts / Hypothèses ──
  const candidates: Array<{
    petal: PetalId
    confidence: number
    evidenceRefs: string[]
  }> = []

  if (config.include_petals_aggregate) {
    for (const petal of PETAL_IDS) {
      const v = clamp01(Number(petalsBaseline?.[petal] ?? 0))
      const evidenceScore = evidenceByPetal[petal]?.score ?? 0
      const confidence = clamp01(0.68 * v + 0.32 * evidenceScore)
      candidates.push({ petal, confidence, evidenceRefs: evidenceByPetal[petal].refs })
    }
  } else {
    // Cas futur : si on désactive pétales, on ne génère pas (pour le moment).
    // On remplit quand même candidates via evidenceScore.
    for (const petal of PETAL_IDS) {
      const evidenceScore = evidenceByPetal[petal]?.score ?? 0
      candidates.push({ petal, confidence: clamp01(evidenceScore), evidenceRefs: evidenceByPetal[petal].refs })
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence)

  const perimeter = evidenceItems.length > 0 ? 'petals_and_chat_context' : 'petals_aggregate_only'

  const facts: ScienceAIOutput['facts'] = []
  const hypotheses: ScienceAIOutput['hypotheses'] = []

  // Facts : top 2 si seuil atteint.
  for (const c of candidates.slice(0, 3)) {
    if (c.confidence >= config.confidence_min_facts) {
      const label = labelFn(c.confidence)
      const text =
        locale === 'en'
          ? `Your current pattern seems primarily linked to ${names[c.petal]}.`
          : locale === 'es'
            ? `Tu patrón actual parece estar principalmente ligado a ${names[c.petal]}.`
            : `Votre motif actuel semble principalement guidé par ${names[c.petal]}.`
      facts.push({
        id: `fact_${c.petal}`,
        text,
        confidence: c.confidence,
        confidence_label: label,
        perimeter,
        evidence_refs: c.evidenceRefs,
        can_be_hidden: false,
      })
    }
  }

  // Hypothèses : candidates suivantes (toujours non manipulatoires, can_be_hidden=true)
  const minHyp = 0.16
  for (const c of candidates) {
    if (facts.find((f) => f.id === `fact_${c.petal}`)) continue
    if (c.confidence < minHyp) continue

    const label = labelFn(c.confidence)
    const text =
      locale === 'en'
        ? `It seems ${names[c.petal]} may also be involved, but with uncertainty—take it as a tentative direction.`
        : locale === 'es'
          ? `Parece que ${names[c.petal]} también podría estar implicado/a, pero con incertidumbre; tómalo como una dirección tentativa.`
          : `Il semble que ${names[c.petal]} puisse aussi être impliquée, mais avec incertitude ; prenez-le comme une direction tentative.`

    hypotheses.push({
      id: `hyp_${c.petal}`,
      text,
      confidence: c.confidence,
      confidence_label: label,
      perimeter,
      evidence_refs: c.evidenceRefs,
      can_be_hidden: true,
    })
  }

  // Assurer au moins 1 hypothèse.
  if (hypotheses.length === 0) {
    hypotheses.push({
      id: 'hyp_fallback',
      text:
        locale === 'en'
          ? `Some tentative directions may appear once you add more explorations and conversations.`
          : locale === 'es'
            ? `Algunas direcciones tentativas podrían aparecer con más exploraciones y conversaciones.`
            : `Des pistes pourraient apparaître davantage avec plus d'explorations et de conversations.`,
      confidence: 0.25,
      confidence_label: 'low',
      perimeter,
      evidence_refs: [],
      can_be_hidden: true,
    })
  }

  const meta: ScienceAIOutput['meta'] = {
    config_version: config.science_generation_version,
    evidence_sources: Array.from(new Set(evidenceSourcesUsed)),
    has_chat_context:
      evidenceSourcesUsed.includes('chat_clairiere') || evidenceSourcesUsed.includes('chat_coach'),
    evidence_item_count: evidenceItems.length,
    generation_version: config.science_generation_version,
  }

  // Persistance (token economy)
  if (db_configured) {
    await upsertScienceProfile({
      userId: params.userId,
      generationVersion: config.science_generation_version,
      facts,
      hypotheses,
      meta,
    })
  }

  return { facts, hypotheses, meta }
}

