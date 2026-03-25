// @ts-nocheck
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { aiApi } from '@/api/ai'
import { sessionsApi } from '@/api/sessions'
import { toast } from '@/hooks/useToast'
import { useSpeech } from '@/hooks/useSpeech'
import { FOUR_DOORS } from '@/data/tarotCards'
import { PETAL_DEFS } from '@/components/FlowerSVG'
import { t } from '@/i18n'

const DOOR_MAP = Object.fromEntries(FOUR_DOORS.map((d) => [d.key, d]))

const EMPTY_PETALS = Object.fromEntries(PETAL_DEFS.map((p) => [p.id, 0.0]))

export function useAiSession({
  thresholdData,
  initialState,
  onComplete,
  cardModal,
}: {
  thresholdData: any
  initialState: any
  onComplete: (finalState: any) => void
  cardModal: null | { door: string; card: { name: string; desc?: string } }
}) {
  // ── État conversation ─────────────────────────────────────
  const [turn, setTurn] = useState(initialState?.turn ?? 0)
  const [petals, setPetals] = useState(initialState?.petals ?? EMPTY_PETALS)
  const [petalsDeficit, setPetalsDeficit] = useState(initialState?.petalsDeficit ?? {})
  const [shadowEvents, setShadowEvents] = useState(initialState?.shadowEvents ?? [])
  const [maxShadowLevel, setMaxShadowLevel] = useState(initialState?.maxShadowLevel ?? 0)
  const [petalsHistory, setPetalsHistory] = useState(initialState?.petalsHistory ?? [])
  const [history, setHistory] = useState(initialState?.history ?? [])
  const [aiMessage, setAiMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [manualText, setManualText] = useState('')
  const [threadContext, setThreadCtx] = useState(null)

  // ── État des portes et cartes (organiques) ────────────────
  const [currentDoor, setCurrentDoor] = useState(initialState?.currentDoor ?? thresholdData?.door_suggested ?? 'love')
  const [currentCard, setCurrentCard] = useState(() => {
    const initCards = initialState?.drawnCards ?? []
    const door = initialState?.currentDoor ?? thresholdData?.door_suggested ?? 'love'
    const found = initCards.find((d) => d.door === door)
    return found ? found.card : null
  })
  const [drawnCards, setDrawnCards] = useState(initialState?.drawnCards ?? [])
  const [doorTurn, setDoorTurn] = useState(initialState?.doorTurn ?? 0)
  const [doorTurnAtCardDraw, setDoorTurnAtCardDraw] = useState(initialState?.doorTurnAtCardDraw ?? null)
  const [lockedDoors, setLockedDoors] = useState(initialState?.lockedDoors ?? [])
  const [anchors, setAnchors] = useState(initialState?.anchors ?? [])
  const [pendingSuggestion, setPendingSugg] = useState(null)
  const [fallbackSuggestionDismissed, setFallbackSuggestionDismissed] = useState(false)
  const [doorIntroMessage, setDoorIntroMessage] = useState(null)
  const [preDrawnCard, setPreDrawnCard] = useState(null)

  const lastAssistantMsg = initialState?.history?.length
    ? [...(initialState.history || [])].reverse().find((m) => m.role === 'assistant')
    : null

  // ── Résumé / message initial (reprise) ────────────────────
  useEffect(() => {
    if (initialState?.history?.length && lastAssistantMsg?.content) {
      const parts = String(lastAssistantMsg.content).split(/\n\n+/)
      const response_a = parts[0]?.trim() || ''
      const question = (parts.slice(1).join('\n\n') || response_a || '').trim()

      setAiMessage((prev) => {
        if (prev) return prev
        return {
          response_a,
          response_b: '',
          question: question || lastAssistantMsg.content,
          reflection: null,
          suggest_card: null,
          thread_context: null,
          shadow_detected: false,
          explore_petal: null,
        }
      })

      if (!initialState?.lockedDoors?.length) {
        const tTurns = Math.floor((initialState.history?.length ?? 0) / 2)
        if (initialState?.doorTurn == null) setDoorTurn(tTurns)

        if (
          initialState?.doorTurnAtCardDraw == null &&
          initialState?.drawnCards?.some((d) => d.door === (initialState?.currentDoor ?? 'love'))
        ) {
          setDoorTurnAtCardDraw(Math.max(0, tTurns - 3))
        }
      }
    } else if (initialState && thresholdData?.firstWords) {
      setAiMessage((prev) => {
        if (prev) return prev
        return {
          response_a: `Vous entrez par ${DOOR_MAP[thresholdData.door_suggested]?.subtitle ?? 'la Porte du Cœur'}.`,
          response_b: thresholdData?.door_reason ?? '',
          question: thresholdData.first_question ?? "Qu'est-ce qui est le plus vivant pour vous en ce moment ?",
          reflection: null,
          suggest_card: null,
          thread_context: null,
          shadow_detected: false,
          explore_petal: null,
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── UI flow flags (non uniquement UI : gating / transitions) ─
  const [showCardDraw, setShowCardDraw] = useState(false)
  const [doorLocked, setDoorLocked] = useState(false)
  const [showSummaryPanel, setShowSummaryPanel] = useState(false)
  const [showInputWithSummary, setShowInputWithSummary] = useState(false)
  const [doorSummary, setDoorSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    if (showSummaryPanel) setShowInputWithSummary(false)
  }, [showSummaryPanel])

  // ── Souveraineté ──────────────────────────────────────────
  const [overriddenPetals, setOverriddenPetals] = useState(new Set())

  function handlePetalOverride(id, val) {
    setPetals((prev) => ({ ...prev, [id]: val }))
    setOverriddenPetals((prev) => new Set([...prev, id]))
  }

  // ── Message initial à afficher (threshold) ───────────────
  const initialAiMsg = useRef({
    response_a: thresholdData
      ? `Vous entrez par ${DOOR_MAP[thresholdData.door_suggested]?.subtitle ?? 'la Porte du Cœur'}.`
      : 'Bienvenue dans le Jardin.',
    response_b: thresholdData?.door_reason ?? '',
    question: thresholdData?.first_question ?? 'Qu\'est-ce qui est là pour vous en ce moment ?',
    reflection: null,
    suggest_card: null,
    thread_context: null,
    shadow_detected: false,
    explore_petal: null,
  })

  // ── STT (textarea + micro) ───────────────────────────────
  const baseAtStartRef = useRef('')
  const { listening, interimText, supported, start, stop, reset } = useSpeech({
    onResult: (tText) => {
      if (!tText) return
      const base = baseAtStartRef.current
      setManualText(base.trimEnd() ? `${base.trimEnd()} ${tText}`.trim() : tText)
    },
  })

  function toggleMic() {
    if (listening) stop()
    else {
      baseAtStartRef.current = manualText
      start()
    }
  }

  const effectiveText =
    listening && interimText ? (manualText.trimEnd() ? `${manualText.trimEnd()} ${interimText}` : interimText) : manualText

  const textToSend = effectiveText

  const lastFailedTextRef = useRef('')
  const RETRY_MAX = 2
  const RETRY_DELAY_MS = 2000

  // ── Sauvegarde session en cours ───────────────────────────
  const saveSessionInProgressRef = useRef(null)
  const lastSummarizedHistoryLen = useRef(0)

  useEffect(
    () => () => {
      if (saveSessionInProgressRef.current) clearTimeout(saveSessionInProgressRef.current)
    },
    []
  )

  function saveSessionInProgress(overrides = {}) {
    if (!thresholdData?.sessionId) return

    const anchorsToUse = overrides.anchors ?? anchors
    const lockedToUse = Array.isArray(overrides.doors_locked)
      ? overrides.doors_locked
      : overrides.doors_locked
        ? overrides.doors_locked.split(',')
        : lockedDoors
    const cardsToUse =
      overrides.cards_drawn ??
      drawnCards.map((d) => ({
        door: d.door,
        card_name: d.card.name,
      }))
    const doorToUse = overrides.currentDoor ?? currentDoor

    const stepData = {
      currentDoor: doorToUse,
      drawnCards: cardsToUse,
      lockedDoors: Array.isArray(lockedToUse) ? lockedToUse : lockedDoors,
      petalsDeficit: overrides.petalsDeficit ?? petalsDeficit,
      petalsHistory: overrides.petalsHistory ?? petalsHistory,
      doorTurn: overrides.doorTurn ?? doorTurn,
      doorTurnAtCardDraw: overrides.doorTurnAtCardDraw ?? doorTurnAtCardDraw,
      shadowEvents: overrides.shadowEvents ?? shadowEvents,
      maxShadowLevel: overrides.maxShadowLevel ?? maxShadowLevel,
    }

    const payload = {
      id: thresholdData.sessionId,
      history: overrides.history ?? history,
      petals: overrides.petals ?? petals,
      cards_drawn: cardsToUse,
      anchors: anchorsToUse,
      doors_locked: Array.isArray(lockedToUse) ? lockedToUse.join(',') : lockedToUse,
      turn_count: overrides.turn_count ?? turn,
      step_data: stepData,
      status: 'in_progress',
    }

    clearTimeout(saveSessionInProgressRef.current)
    saveSessionInProgressRef.current = setTimeout(() => {
      sessionsApi
        .update(payload)
        .then(() => {})
        .catch(() => {})
    }, 500)
  }

  // ── Gating : fallback suggestion ─────────────────────────
  const fallbackSuggestion = useMemo(() => {
    const door = DOOR_MAP[currentDoor]
    if (!door?.group?.length) return { door: currentDoor, reason: t('session.cardCanIlluminate') }
    const card = door.group[Math.floor(Math.random() * door.group.length)]
    return { door: currentDoor, reason: t('session.cardCanIlluminate'), card_name: card.name }
  }, [currentDoor])

  // ── Envoi au Tuteur ──────────────────────────────────────
  async function sendToTuteur(text) {
    if (!text.trim()) return
    if (listening) stop()

    if (!currentCard) {
      await sendToTuteurWithCard(text, '__no_card__', currentDoor)
      return
    }
    await sendToTuteurWithCard(text, currentCard.name, currentDoor)
  }

  async function sendToTuteurWithCard(text, cardName, cardGroup) {
    const userMsg = { role: 'user', content: text }
    const newHistory = [...history, userMsg]

    setError('')
    setHistory(newHistory)
    setManualText('')
    reset()
    setLoading(true)
    lastFailedTextRef.current = text

    const payload = {
      card_name: cardName === '__no_card__' ? `Porte : ${cardGroup}` : cardName,
      card_group: cardGroup,
      transcript: text,
      history: history,
      current_petals: petals,
      overridden_petals: Object.fromEntries([...overriddenPetals].map((id) => [id, petals[id]])),
      locked_doors: lockedDoors,
      turn,
    }

    for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
      try {
        const res = await aiApi.tuteur(payload)

        // Historique pour l'évolution (état avant mise à jour)
        setPetalsHistory((prev) => [...prev, { petals: { ...petals }, petalsDeficit: { ...petalsDeficit } }])

        // Respecter les overrides
        const nextPetals = { ...res.petals }
        overriddenPetals.forEach((id) => {
          nextPetals[id] = petals[id]
        })
        setPetals(nextPetals)
        setPetalsDeficit(res.petals_deficit ?? {})

        const responseA = (res.response_a ?? '').trim() || 'Je vous reçois.'
        const questionText = (res.question ?? '').trim() || "Qu'est-ce qui est le plus vivant dans ce que vous venez de dire ?"

        const aMsg = { role: 'assistant', content: `${responseA}\n\n${questionText}` }
        const nextHistory = [...newHistory, aMsg]

        setHistory(nextHistory)
        setAiMessage({ ...res, response_a: responseA, question: questionText })
        setTurn((tPrev) => tPrev + 1)
        setDoorTurn((tPrev) => tPrev + 1)
        setFallbackSuggestionDismissed(false)
        if (res.thread_context) setThreadCtx(res.thread_context)

        reset()
        setManualText('')

        // Tracker les détections d'ombre
        const nextShadowEvents = [...shadowEvents]
        const shadowLvl = res.shadow_level ?? 0

        if (shadowLvl >= 1) {
          nextShadowEvents.push({
            turn: turn + 1,
            door: cardGroup,
            level: shadowLvl,
            urgent: res.shadow_urgent ?? false,
            resource_card: res.resource_card ?? null,
            at: new Date().toISOString(),
          })

          setShadowEvents(nextShadowEvents)
          if (shadowLvl > maxShadowLevel) setMaxShadowLevel(shadowLvl)
        }

        // Sauvegarde session en cours (historique complet)
        const nextPetalsHistory = [...petalsHistory, { petals: { ...petals }, petalsDeficit: { ...petalsDeficit } }]
        const nextMax = Math.max(maxShadowLevel, shadowLvl)

        saveSessionInProgress({
          history: nextHistory,
          petals: { ...nextPetals, ...Object.fromEntries([...overriddenPetals].map((id) => [id, petals[id]])) },
          turn_count: turn + 1,
          doorTurn: doorTurn + 1,
          petalsDeficit: res.petals_deficit ?? {},
          petalsHistory: nextPetalsHistory,
          shadowEvents: nextShadowEvents,
          maxShadowLevel: nextMax,
        })

        // Proposition de carte si l'IA suggère — pour la porte courante
        if (res.suggest_card && res.suggest_card.door === currentDoor && !currentCard && !showCardDraw && lockedDoors.length < 4) {
          setPendingSugg(res.suggest_card)
        }

        // Diagnostic : OpenRouter a échoué, on utilise le mock
        if (res._openrouter_error && !window.__fleurOpenRouterWarned) {
          window.__fleurOpenRouterWarned = true
          toast(`IA : OpenRouter indisponible (${res._openrouter_error}). Mode dégradé actif.`, 'error')
        }

        setLoading(false)
        return
      } catch (e) {
        if (attempt < RETRY_MAX) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
          continue
        }

        setHistory(history)
        setManualText(text)
        setError(t('session.tutorErrorSoft'))
        setLoading(false)
      }
    }
  }

  function handleRetrySend() {
    const text = lastFailedTextRef.current || manualText
    if (!text.trim()) return
    setError('')
    if (!currentCard) sendToTuteurWithCard(text, '__no_card__', currentDoor)
    else sendToTuteurWithCard(text, currentCard.name, currentDoor)
  }

  // ── Carte tirée ───────────────────────────────────────────
  function handleCardDrawn(card, doorOverride, opts = {}) {
    const { isRandomDraw = false } = opts
    const doorToUse = doorOverride ?? currentDoor
    const doorObj = DOOR_MAP[doorToUse] ?? FOUR_DOORS[0]

    const cardInDoor = doorObj?.group?.some((c) => (c.name || '').toLowerCase() === (card?.name || '').toLowerCase())
    const cardToUse = cardInDoor
      ? card
      : doorObj?.group?.[Math.floor(Math.random() * (doorObj?.group?.length || 1))] ?? card

    setDrawnCards((prev) => [...prev, { door: doorToUse, card: cardToUse }])
    setShowCardDraw(false)
    setPendingSugg(null)

    if (doorToUse === currentDoor) {
      setCurrentCard(cardToUse)
      setDoorTurnAtCardDraw(doorTurn)

      if (isRandomDraw) {
        aiApi
          .cardQuestion({
            card_name: cardToUse.name,
            card_desc: cardToUse.desc || '',
            door: currentDoor,
            history,
          })
          .then((res) => {
            if (res?.question) {
              const response_a = res.response_a || `Vous avez tiré « ${cardToUse.name} ».`
              const newMsg = {
                response_a,
                response_b: '',
                question: res.question,
                reflection: null,
                suggest_card: null,
                thread_context: null,
                shadow_detected: false,
                explore_petal: null,
              }

              setAiMessage(newMsg)

              // Mettre à jour l'historique pour que la reprise affiche le bon texte (carte tirée, pas la suggérée)
              setHistory((prev) => {
                if (prev.length === 0) return prev
                const last = prev[prev.length - 1]
                if (last?.role !== 'assistant') return prev
                const updated = [...prev.slice(0, -1), { role: 'assistant', content: `${response_a}\n\n${res.question}` }]
                saveSessionInProgress({ history: updated })
                return updated
              })
            }
          })
          .catch(() => {})
      }
    }

    saveSessionInProgress({
      cards_drawn: [...drawnCards, { door: doorToUse, card: cardToUse }].map((d) => ({ door: d.door, card_name: d.card?.name })),
      doorTurnAtCardDraw: doorToUse === currentDoor ? doorTurn : doorTurnAtCardDraw,
    })
  }

  // ── Verrouillage de porte (synthèse) ──────────────────────
  function handleDoorLock({ synthesis, habit }) {
    const door = DOOR_MAP[currentDoor]

    const newAnchor = {
      door: currentDoor,
      subtitle: door?.subtitle ?? currentDoor,
      synthesis,
      habit: habit || '',
    }

    const newLocked = [...lockedDoors, currentDoor]
    setAnchors((prev) => [...prev, newAnchor])
    setLockedDoors((prev) => [...prev, currentDoor])
    setDoorLocked(true)

    saveSessionInProgress({
      anchors: [...anchors, newAnchor],
      doors_locked: newLocked,
    })
  }

  // ── Proposition de passage : résumé ────────────────────────
  const hasCardForCurrentDoor = drawnCards.some((d) => d.door === currentDoor) || !!currentCard
  const exchangesSinceCard = doorTurnAtCardDraw !== null ? doorTurn - doorTurnAtCardDraw : 0
  const hasIntegratedCard = exchangesSinceCard >= 3
  const isResumeWithEnoughExchanges = !!initialState && doorTurn >= 4 && hasCardForCurrentDoor

  const shouldProposeTransition =
    (aiMessage?.turn_complete || doorTurn >= 3) &&
    (hasIntegratedCard || isResumeWithEnoughExchanges) &&
    !doorLocked &&
    !showSummaryPanel &&
    hasCardForCurrentDoor

  useEffect(() => {
    if (!shouldProposeTransition) return

    if (aiMessage?.door_summary_preview) {
      setDoorSummary({
        door_summary_preview: aiMessage.door_summary_preview,
        next_door_suggestion: aiMessage.next_door_suggestion,
      })
      setShowSummaryPanel(true)
      lastSummarizedHistoryLen.current = history.length
      return
    }

    setSummaryLoading(true)
    setShowSummaryPanel(true)
    lastSummarizedHistoryLen.current = history.length

    const door = DOOR_MAP[currentDoor]
    aiApi
      .extractDoorSummary({
        history: history,
        door_subtitle: door?.subtitle ?? 'cette Porte',
        door_key: currentDoor,
      })
      .then((res) => {
        setDoorSummary({
          door_summary_preview: res,
          next_door_suggestion: aiMessage?.next_door_suggestion,
        })
      })
      .catch(() => {
        const lastUser = history.filter((m) => m.role === 'user').pop()
        setDoorSummary({
          door_summary_preview: {
            synthesis_suggestion:
              lastUser?.content?.trim() ||
              `${t('session.explorationOf')} ${door?.subtitle ?? t('session.thisDoor')}`,
            paths_solutions: '',
          },
        })
      })
      .finally(() => setSummaryLoading(false))
  }, [shouldProposeTransition]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mise à jour du résumé quand l'utilisateur continue à échanger après l'affichage du résumé
  useEffect(() => {
    if (!showSummaryPanel || doorLocked || history.length <= lastSummarizedHistoryLen.current) return
    lastSummarizedHistoryLen.current = history.length

    setSummaryLoading(true)
    const door = DOOR_MAP[currentDoor]

    aiApi
      .extractDoorSummary({
        history,
        door_subtitle: door?.subtitle ?? 'cette Porte',
        door_key: currentDoor,
      })
      .then((res) => {
        setDoorSummary((prev) => ({
          door_summary_preview: res,
          next_door_suggestion: prev?.next_door_suggestion,
        }))
      })
      .catch(() => {})
      .finally(() => setSummaryLoading(false))
  }, [showSummaryPanel, doorLocked, history, currentDoor])

  function confirmDoorTransition() {
    const prev = doorSummary?.door_summary_preview || {}
    const synthesis = prev.synthesis_suggestion || prev.synthesis || ''
    handleDoorLock({ synthesis, habit: '' })
    setShowSummaryPanel(false)
    setShowInputWithSummary(false)
    setDoorSummary(null)
  }

  // ── Passage à la porte suivante après confirmation ───────
  useEffect(() => {
    if (!doorLocked) return

    if (lockedDoors.length >= 4) {
      onComplete({
        petals,
        petalsDeficit,
        petalsHistory,
        cardsDrawn: drawnCards.map((d) => d.card.name),
        drawnCardsWithDetails: drawnCards,
        history,
        anchors,
        lockedDoors,
        turnCount: turn,
        sessionId: thresholdData?.sessionId,
      })
      return
    }

    const tNext = setTimeout(() => nextDoor(), 1500)
    return () => clearTimeout(tNext)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doorLocked, lockedDoors.length])

  // ── Porte suivante ────────────────────────────────────────
  async function nextDoor() {
    const allDoorKeys = FOUR_DOORS.map((d) => d.key)
    const remaining = allDoorKeys.filter((k) => !lockedDoors.includes(k) && k !== currentDoor)

    if (remaining.length === 0) {
      onComplete({
        petals,
        petalsDeficit,
        petalsHistory,
        cardsDrawn: drawnCards.map((d) => d.card.name),
        drawnCardsWithDetails: drawnCards,
        history,
        anchors,
        lockedDoors: [...lockedDoors, currentDoor],
        turnCount: turn,
        sessionId: thresholdData?.sessionId,
      })
      return
    }

    const nextKey =
      pendingSuggestion?.door && remaining.includes(pendingSuggestion.door) ? pendingSuggestion.door : remaining[0]

    const nextDoorObj = DOOR_MAP[nextKey] ?? FOUR_DOORS[0]
    const existingDrawn = drawnCards.find((x) => x.door === nextKey)
    const nextDoorTurnAtCardDraw = existingDrawn ? 0 : null

    setCurrentDoor(nextKey)
    setDoorLocked(false)
    setDoorTurn(0)
    setAiMessage(null)
    setPendingSugg(null)
    setFallbackSuggestionDismissed(false)
    setShowCardDraw(false)
    setDoorIntroMessage(null)
    setPreDrawnCard(null)
    reset()
    setDoorTurnAtCardDraw(nextDoorTurnAtCardDraw)

    saveSessionInProgress({ currentDoor: nextKey, doorTurn: 0, doorTurnAtCardDraw: nextDoorTurnAtCardDraw })

    const card = existingDrawn
      ? existingDrawn.card
      : nextDoorObj.group[Math.floor(Math.random() * nextDoorObj.group.length)]

    if (existingDrawn) {
      setCurrentCard(card)
    } else {
      setCurrentCard(null)
      setPreDrawnCard(card)
    }

    try {
      const introRes = await aiApi.doorIntro({
        door: nextKey,
        first_words: thresholdData?.firstWords || '',
        anchors,
        card_name: card.name,
        card_theme: card.desc?.split('\n')[0] || '',
        history,
        locked_doors: lockedDoors,
        petals,
      })

      const txt = introRes?.door_intro || introRes?.question || ''
      setDoorIntroMessage({
        response_a: txt,
        response_b: '',
        question: introRes?.question || "Qu'est-ce qui est vivant pour vous en entrant dans cette porte ?",
        reflection: null,
        suggest_card: null,
        thread_context: null,
        shadow_detected: false,
        explore_petal: null,
      })
    } catch (_) {
      setDoorIntroMessage({
        response_a: `${nextDoorObj.subtitle} ${t('session.invitesContinue')}`,
        response_b: '',
        question: 'Qu\'est-ce qui est vivant pour vous en entrant dans cette porte ?',
        reflection: null,
        suggest_card: null,
        thread_context: null,
        shadow_detected: false,
        explore_petal: null,
      })
    }
  }

  // ── Card context (pour le panneau carte) ────────────────
  const [cardContext, setCardContext] = useState(null)
  const [cardContextLoading, setCardContextLoading] = useState(false)

  useEffect(() => {
    if (!cardModal) {
      setCardContext(null)
      setCardContextLoading(false)
      return
    }

    if (!history.length) {
      setCardContext(null)
      setCardContextLoading(false)
      return
    }

    setCardContextLoading(true)
    setCardContext(null)

    aiApi
      .cardContext({
        card_name: cardModal.card.name,
        card_desc: cardModal.card.desc || '',
        door: cardModal.door,
        history,
      })
      .then((res) => setCardContext(res?.context || ''))
      .catch(() => setCardContext(''))
      .finally(() => setCardContextLoading(false))
  }, [cardModal]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shadow petal id (pour surlignage) ────────────────────
  const shadowPetalId = aiMessage?.shadow_detected
    ? Object.entries(petals).reduce((a, b) => (b[1] > a[1] ? b : a), ['', 0])[0]
    : null

  // ── Message d'affichage (bullet) ─────────────────────────
  const displayMessage =
    aiMessage ??
    doorIntroMessage ??
    (lastAssistantMsg
      ? {
          response_a: '',
          response_b: '',
          question: lastAssistantMsg.content,
          reflection: null,
          suggest_card: null,
          thread_context: null,
          shadow_detected: false,
          explore_petal: null,
        }
      : initialAiMsg.current)

  return {
    // speech
    listening,
    interimText,
    supported,
    toggleMic,
    start,
    stop,
    reset,
    manualText,
    setManualText,
    effectiveText,
    textToSend,

    // conversation / petals
    turn,
    petals,
    petalsDeficit,
    shadowEvents,
    maxShadowLevel,
    petalsHistory,
    history,
    aiMessage,
    loading,
    error,
    threadContext,

    // doors/cards
    currentDoor,
    currentCard,
    drawnCards,
    doorTurn,
    doorTurnAtCardDraw,
    lockedDoors,
    anchors,
    pendingSuggestion,
    fallbackSuggestion,
    fallbackSuggestionDismissed,
    doorIntroMessage,
    preDrawnCard,

    // gating
    showCardDraw,
    setShowCardDraw,
    doorLocked,
    showSummaryPanel,
    showInputWithSummary,
    setShowInputWithSummary,
    doorSummary,
    summaryLoading,

    // souveraineté
    overriddenPetals,
    handlePetalOverride,

    // actions
    sendToTuteur,
    handleRetrySend,
    handleCardDrawn,
    handleDoorLock,
    confirmDoorTransition,
    clearPendingSuggestion: () => setPendingSugg(null),
    dismissFallbackSuggestion: () => setFallbackSuggestionDismissed(true),
    clearPreDrawnCard: () => setPreDrawnCard(null),

    // card context
    cardContext,
    cardContextLoading,

    // derived
    shadowPetalId,
    displayMessage,
  }
}

