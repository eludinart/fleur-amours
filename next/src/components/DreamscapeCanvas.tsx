// @ts-nocheck
'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FlowerSVG } from '@/components/FlowerSVG'
import { VoiceTextInput } from '@/components/VoiceTextInput'
import { aiApi } from '@/api/ai'
import { dreamscapeApi } from '@/api/dreamscape'
import { proxyImageUrl } from '@/lib/api-client'
import { toast } from '@/hooks/useToast'
import { ALL_CARDS, LOVE, BACK_IMG, getCardTranslated } from '@/data/tarotCards'
import { DreamscapeRosace } from '@/components/DreamscapeRosace'
import { FLOWER_OFFSET } from '@/config/dreamscapeLayout'
import { buildSlotsFromSaved, initSlots } from '@/lib/dreamscape-slots'
import { captureDreamscapeDomToDataUrl } from '@/lib/dreamscape-snapshot-capture'
import { getShareBaseUrl } from '@/utils/dreamscapeShare'
import { ShareSocialButtons } from '@/components/ShareSocialButtons'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

// Fleur de référence complète (silhouette) pour l’effet « fleur double »
const FULL_SILHOUETTE_PETALS = Object.fromEntries(
  ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'].map(id => [id, 1])
)

export function DreamscapeCanvas({ initialData = null, resumeId = null }) {
  useStore((s) => s.locale)
  const [text, setText] = useState('')
  const [liveText, setLiveText] = useState('')
  const [poeticReflection, setPoeticReflection] = useState(
    () => (initialData?.poeticReflection ?? '') || (initialData?.history?.filter(m => m.role === 'assistant').pop()?.content ?? '')
  )
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [history, setHistory] = useState(
    () => (initialData?.history ?? []).filter(m => m.role !== 'closing')
  )
  const [slots, setSlots] = useState(
    () => (initialData ? buildSlotsFromSaved(initialData.slots) : initSlots())
  )
  const [livePetals, setLivePetals] = useState(() => initialData?.petals ?? {})
  const [petalScores, setPetalScores] = useState<Record<string, number>>(() => {
    // Start scores from saved petals if resuming.
    const src = (initialData?.petals ?? {}) as Record<string, number>
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(src)) {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) out[k] = Math.max(0, Math.min(3, n)) // keep bounded-ish
    }
    return out
  })
  const [livePetalsDeficit, setLivePetalsDeficit] = useState(() => initialData?.petalsDeficit ?? {})
  const [isSaving, setIsSaving] = useState(false)
  const [shadowState, setShadowState] = useState(null)
  const [shadowDismissed, setShadowDismissed] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showCloseNudge, setShowCloseNudge] = useState(false)
  const [closingActions, setClosingActions] = useState([])
  const [labelsToggled, setLabelsToggled] = useState(false)
  const [hoveredCardPosition, setHoveredCardPosition] = useState(null)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [closeModalPreview, setCloseModalPreview] = useState(null)
  const [closeModalStage, setCloseModalStage] = useState<'confirm' | 'saved'>('confirm')
  const [closeModalSynthesis, setCloseModalSynthesis] = useState<string>('')
  const [closeModalSections, setCloseModalSections] = useState<any>(null)
  const [closeModalSavedId, setCloseModalSavedId] = useState<number | null>(null)
  const [closeModalShareUrl, setCloseModalShareUrl] = useState<string | null>(null)
  const [hardCloseMessage, setHardCloseMessage] = useState<string>('')
  const [dreamscapeConfig, setDreamscapeConfig] = useState(() => ({
    close_mode: 'model', // 'model'|'manual'|'auto' (auto kept for backward behavior)
    max_cartes_par_tour: 1,
    min_echanges_avant_cloture: 20,
    objectif_echanges: 20,
    force_question_finale: true,
  }))
  const revealOrderRef = useRef(
    initialData ? Math.max(0, ...(initialData.slots ?? []).map(s => s.revealOrder ?? 0)) : 0
  )
  const allRevealedRef = useRef(false)
  allRevealedRef.current = slots.every(s => !s.faceDown)
  const userMessageCount = history.filter(m => m.role === 'user').length
  /** Dès qu’au moins un échange — la promenade peut se clôturer quand le cercle est complet */
  const canCloseTirage = allRevealedRef.current && userMessageCount >= 1
  const closeNudgeShownRef = useRef(false)
  const autoEndFormTriggeredRef = useRef(false)
  const snapshotRef = useRef(null)

  useEffect(() => {
    autoEndFormTriggeredRef.current = false
    closeNudgeShownRef.current = false
    setShowCloseNudge(false)
    setHardCloseMessage('')
  }, [resumeId, initialData?.id])

  // Limite haute configurable: nudge à max_echanges, puis clôture forcée après +extra.
  useEffect(() => {
    const max = Number(dreamscapeConfig?.max_echanges ?? 0)
    const extra = Number(dreamscapeConfig?.extra_echanges_avant_forcer_cloture ?? 0)
    if (!Number.isFinite(max) || max <= 0) return
    const userTurns = history.filter(m => m.role === 'user').length
    if (userTurns >= max && !showCloseModal) {
      // Nudge doux à l'atteinte du cap (une seule fois).
      if (!closeNudgeShownRef.current) {
        closeNudgeShownRef.current = true
        setHardCloseMessage(
          `Tu as déjà fait ${userTurns} échanges. Si tu as trouvé ce que tu venais chercher, tu peux clôturer maintenant — sinon tu peux encore poursuivre un peu.`
        )
        setShowCloseNudge(true)
      }
    }
    // Forcer la clôture après max + extra (doucement, avec message clair).
    if (userTurns >= max + extra && !showCloseModal) {
      setHardCloseMessage(
        `On arrive au terme de cette promenade (${max + extra} échanges). Pour que ce qui a émergé puisse vraiment s'intégrer, je te propose de sceller la promenade maintenant.`
      )
      setShowCloseNudge(false)
      setShowCloseModal(true)
    }
  }, [history, dreamscapeConfig, showCloseModal])

  // Petite modale douce : s'ouvre une seule fois quand "Clôturer" devient disponible.
  useEffect(() => {
    if (showCloseModal) return
    if (!canCloseTirage) return
    if (closeNudgeShownRef.current) return
    closeNudgeShownRef.current = true
    const tmr = window.setTimeout(() => setShowCloseNudge(true), 450)
    return () => window.clearTimeout(tmr)
  }, [canCloseTirage, showCloseModal])

  /** Ouvrir le formulaire de fin dès que toutes les cartes sont révélées (promenade terminée) */
  useEffect(() => {
    if (initialData?.history?.some((m) => m.role === 'closing')) return
    if (autoEndFormTriggeredRef.current) return
    if (isAnalyzing) return
    if (!slots.every((s) => !s.faceDown)) return
    if (!history.some((m) => m.role === 'user')) return
    // Si la clôture est pilotée par l'IA ou manuelle, on ne déclenche pas la modal automatiquement.
    if ((dreamscapeConfig?.close_mode ?? 'model') !== 'auto') return
    autoEndFormTriggeredRef.current = true
    const t = window.setTimeout(() => setShowCloseModal(true), 650)
    return () => window.clearTimeout(t)
  }, [slots, history, initialData, isAnalyzing, dreamscapeConfig])

  const captureSnapshot = useCallback(
    () => captureDreamscapeDomToDataUrl(snapshotRef.current),
    []
  )

  useEffect(() => {
    if (!showCloseModal) {
      setCloseModalPreview(null)
      setCloseModalStage('confirm')
      setCloseModalSynthesis('')
      setCloseModalSections(null)
      setCloseModalSavedId(null)
      setCloseModalShareUrl(null)
      return
    }
    let alive = true
    const run = async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      try {
        const url = await captureSnapshot()
        if (alive && url) setCloseModalPreview(url)
      } catch {
        /* aperçu optionnel */
      }
    }
    run()
    return () => {
      alive = false
    }
  }, [showCloseModal, captureSnapshot])

  const resetWalk = useCallback(() => {
    setText('')
    setLiveText('')
    setHistory([])
    setPoeticReflection(t('dreamscapeCanvas.openingQuestion'))
    setSlots(initSlots())
    setLivePetals({})
    setPetalScores({})
    setLivePetalsDeficit({})
    setShadowState(null)
    setShadowDismissed(false)
    setClosingActions([])
    setLabelsToggled(false)
    setHoveredCardPosition(null)
    setSelectedCard(null)
    setShowCloseModal(false)
    setCloseModalStage('confirm')
    setCloseModalSynthesis('')
    setCloseModalSections(null)
    setCloseModalSavedId(null)
    setCloseModalShareUrl(null)
    revealOrderRef.current = 0
    autoEndFormTriggeredRef.current = false
    allRevealedRef.current = false
  }, [setText, setLiveText, setHistory, setPoeticReflection, setSlots, setLivePetals, setLivePetalsDeficit])

  useEffect(() => {
    const mq = window.matchMedia('(hover: none)')
    const set = () => setIsTouchDevice(mq.matches)
    set()
    mq.addEventListener('change', set)
    return () => mq.removeEventListener('change', set)
  }, [])
  const locale = useStore((s) => s.locale)
  const router = useRouter()
  const userTurns = history.filter(m => m.role === 'user').length
  const forcedCloseActive = (() => {
    const max = Number(dreamscapeConfig?.max_echanges ?? 0)
    const extra = Number(dreamscapeConfig?.extra_echanges_avant_forcer_cloture ?? 0)
    return closeModalStage !== 'saved' && Number.isFinite(max) && max > 0 && userTurns >= max + extra
  })()

  // Lookup rapide nom → carte
  const cardsMap = useMemo(() => {
    const map = {}
    ALL_CARDS.forEach(card => {
      map[card.name] = card
      // clé normalisée (sans accents, sans espaces) pour correspondance approximative
      const norm = card.name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
      map[norm] = card
    })
    return map
  }, [])

  const findCard = useCallback((name) => {
    if (!name) return null
    if (cardsMap[name]) return cardsMap[name]
    const norm = name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
    if (cardsMap[norm]) return cardsMap[norm]
    // correspondance partielle
    return Object.values(cardsMap).find(c => {
      const cn = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
      return cn.includes(norm) || norm.includes(cn)
    }) ?? null
  }, [cardsMap])

  const cardImageUrl = (url) => proxyImageUrl(url) ?? url

  // Calcule les props pour DreamscapeRosace à partir des slots courants
  const rosaceCards = useMemo(() =>
    slots.map(slot => {
      const card = findCard(slot.card)
      const img = slot.faceDown ? BACK_IMG : (card ? cardImageUrl(card.img) : BACK_IMG)
      return {
        id: `${slot.position}:${slot.card}`,
        img,
        angleDeg: slot.angleDeg,
        faceDown: slot.faceDown,
        cardName: slot.card,
        halo: slot.halo ?? null,
        position: slot.position,
      }
    }),
    [slots, findCard]
  )

  const positionToPetalId = useCallback((pos) => {
    if (!pos) return null
    const m = { Agapè: 'agape', Philautia: 'philautia', Mania: 'mania', Storgè: 'storge', Pragma: 'pragma', Philia: 'philia', Ludus: 'ludus', Éros: 'eros' }
    return m[pos] ?? null
  }, [])

  // Contexte fleur → texte envoyé à l'IA
  const buildCardPositions = useCallback(() =>
    slots.reduce((acc, slot) => {
      acc[slot.position] = slot.faceDown ? `${slot.card} (cachée)` : `${slot.card} (révélée)`
      return acc
    }, {}),
    [slots]
  )

  // Révèle ou remplace des cartes dans les 8 slots
  // cardToReplace : quand toutes révélées, cible le slot contenant cette carte (sinon slot le plus ancien)
  const revealCards = useCallback((cardNames, context = {}) => {
    if (!cardNames?.length) return
    const shadowDetected = context.shadowDetected ?? false
    const hasDeficit = context.hasDeficit ?? false
    const hasPetals = context.hasPetals ?? false
    const cardToReplace = context.cardToReplace ?? null
    const halo = (shadowDetected && hasDeficit) ? 'shadow' : (hasPetals && !shadowDetected) ? 'light' : null
    setSlots(prev => {
      const next = prev.map(s => ({ ...s }))
      let counter = revealOrderRef.current

      const resolveTarget = (nextSlots, newCardName) => {
        const existing = nextSlots.find(s => s.card === newCardName)
        if (existing) return null
        let t = nextSlots.find(s => s.faceDown)
        if (t) return t
        if (cardToReplace) {
          const toReplaceCard = findCard(cardToReplace)
          if (toReplaceCard) {
            const slot = nextSlots.find(s => s.card === toReplaceCard.name)
            if (slot) return slot
          }
        }
        return nextSlots.reduce((oldest, s) =>
          !oldest || s.revealOrder < oldest.revealOrder ? s : oldest,
          null
        )
      }

      cardNames.forEach(name => {
        const card = findCard(name)
        if (!card) return

        const existing = next.find(s => s.card === card.name)
        if (existing) {
          if (existing.faceDown) {
            existing.faceDown = false
            existing.revealOrder = ++counter
            if (halo) existing.halo = halo
          }
          return
        }

        const target = resolveTarget(next, card.name)
        if (target) {
          target.card = card.name
          target.faceDown = false
          target.revealOrder = ++counter
          if (halo) target.halo = halo
        }
      })

      revealOrderRef.current = counter
      return next
    })
  }, [findCard])

  // Accumule les pétales lumière (nouvelles valeurs fusionnées, légère décroissance)
  const mergePetals = useCallback((newPetals) => {
    if (!newPetals || !Object.keys(newPetals).length) return
    // We keep a cumulative "blossoming" score per petal over the whole walk,
    // then normalize so 1-3 petals dominate naturally while others remain present.
    setPetalScores((prev) => {
      const next = { ...prev }
      // Very light decay to avoid infinite growth, but keep long-term memory.
      for (const k in next) next[k] = +(next[k] * 0.995).toFixed(4)
      for (const [k, v] of Object.entries(newPetals)) {
        const inc = Math.max(0, Math.min(1, Number(v)))
        if (!Number.isFinite(inc) || inc <= 0) continue
        next[k] = +((Number(next[k] ?? 0) + inc * 0.9)).toFixed(4)
      }
      // Derive display intensities from normalized scores.
      const vals = Object.values(next).filter((x) => Number.isFinite(x) && x > 0)
      const max = vals.length ? Math.max(...vals) : 0
      const display: Record<string, number> = {}
      if (max > 0) {
        for (const [k, s] of Object.entries(next)) {
          const ratio = Math.max(0, Math.min(1, Number(s) / max))
          // Slight gamma to keep dominants clearer.
          display[k] = +Math.pow(ratio, 0.85).toFixed(3)
        }
      }
      setLivePetals(display)
      return next
    })
  }, [])

  // Accumule les pétales ombre (tensions/déficits) pour la fleur duale
  const mergePetalsDeficit = useCallback((newDeficit) => {
    if (!newDeficit || !Object.keys(newDeficit).length) return
    setLivePetalsDeficit(prev => {
      const next = { ...prev }
      for (const k in next) next[k] = +(next[k] * 0.9).toFixed(3)
      for (const [k, v] of Object.entries(newDeficit)) {
        const val = +v
        if (val > 0.02) next[k] = Math.min(0.5, Math.max(next[k] ?? 0, val))
      }
      return next
    })
  }, [])

  // ── Phrase d'ouverture (sauf reprise) ─────────────────────────────
  useEffect(() => {
    if (initialData) return
    const loadOpening = async () => {
      setIsAnalyzing(true)
      try {
        const res = await aiApi.analyzeMood({ text: 'Bonjour', history: [] })
        if (res?.poetic_reflection) {
          setPoeticReflection(res.poetic_reflection)
          setHistory([{ role: 'assistant', content: res.poetic_reflection }])
        } else {
          setPoeticReflection(t('dreamscapeCanvas.openingQuestion'))
        }
      } catch (e) {
        setPoeticReflection(t('dreamscapeCanvas.openingQuestion'))
      } finally {
        setIsAnalyzing(false)
      }
    }
    loadOpening()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Envoi d'un message ───────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const msg = (liveText || text).trim()
    if (!msg || isAnalyzing) return

    // Si on a dépassé la limite forcée, on n'envoie plus; on invite à clôturer.
    const max = Number(dreamscapeConfig?.max_echanges ?? 0)
    const extra = Number(dreamscapeConfig?.extra_echanges_avant_forcer_cloture ?? 0)
    const userTurnsNow = history.filter(m => m.role === 'user').length
    if (Number.isFinite(max) && max > 0 && userTurnsNow >= max + extra) {
      setHardCloseMessage(
        `On est au-delà de la limite douce (${max + extra} échanges). Je te propose de clôturer la promenade maintenant.`
      )
      setShowCloseNudge(false)
      setShowCloseModal(true)
      return
    }

    const newHistory = [...history, { role: 'user', content: msg }]
    setHistory(newHistory)
    setText('')
    setLiveText('')
    setIsAnalyzing(true)

    try {
      const cardPositions = buildCardPositions()
      const allRevealed = allRevealedRef.current
      const res = await aiApi.analyzeMood({
        text: msg,
        history,
        card_positions: cardPositions,
        all_revealed: allRevealed,  // indique à l'IA qu'elle peut proposer des remplacements
      })

      if (res?.dreamscape_config) setDreamscapeConfig(res.dreamscape_config)
      if (res?.poetic_reflection) {
        setPoeticReflection(res.poetic_reflection)
        setHistory([...newHistory, { role: 'assistant', content: res.poetic_reflection }])
      }
      if (res?.active_petals) mergePetals(res.active_petals)
      let deficitToMerge = res?.petals_deficit
      if (res?.shadow_detected) {
        const level = res.shadow_level ?? 1
        const minTurns = level >= 4 ? 0 : level >= 3 ? 2 : 3
        const userTurns = newHistory.filter(m => m.role === 'user').length
        if (userTurns >= minTurns || res.shadow_urgent) {
          setShadowState({ detected: true, level, card: res.shadow_card ?? null })
          setShadowDismissed(false)
        }
        const hasDeficitFromApi = deficitToMerge && Object.values(deficitToMerge).some(v => (v ?? 0) > 0.05)
        if (!hasDeficitFromApi) {
          const cardNorm = (res.shadow_card || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '')
          const petalFromCard = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'].find(slug => slug === cardNorm || cardNorm.includes(slug))
          const intensity = Math.min(0.4, 0.1 + level * 0.08)
          const synthetic = {}
          if (petalFromCard) {
            synthetic[petalFromCard] = intensity
          } else if (level >= 3) {
            synthetic.philautia = intensity * 0.9
            synthetic.mania = intensity * 0.7
          } else {
            synthetic.philautia = intensity
          }
          if (Object.keys(synthetic).length) deficitToMerge = { ...(deficitToMerge || {}), ...synthetic }
        }
      } else {
        setShadowState(null)
      }
      if (deficitToMerge && Object.keys(deficitToMerge).length) mergePetalsDeficit(deficitToMerge)
      if (res?.cards_to_reveal?.length) {
        const allRevealed = allRevealedRef.current
        const maxPerTurn = Math.max(0, Math.min(3, Number(dreamscapeConfig?.max_cartes_par_tour ?? 1)))
        const toReveal = maxPerTurn > 0
          ? res.cards_to_reveal.slice(0, maxPerTurn)
          : []
        const hasDeficit = deficitToMerge && Object.values(deficitToMerge).some(v => (v ?? 0) > 0.05)
        revealCards(toReveal, {
          shadowDetected: !!res.shadow_detected,
          hasDeficit,
          hasPetals: !!(res.active_petals && Object.keys(res.active_petals).length),
          cardToReplace: allRevealed ? (res.card_to_replace ?? null) : null,
        })
      }
      if ((dreamscapeConfig?.close_mode ?? 'model') === 'model') {
        const minTurns = Number(dreamscapeConfig?.min_echanges_avant_cloture ?? 0)
        const userTurns = newHistory.filter(m => m.role === 'user').length
        if (res?.propose_close && allRevealedRef.current && userTurns >= minTurns) {
          setClosingActions(Array.isArray(res.propose_close_actions) ? res.propose_close_actions : [])
          setShowCloseModal(true)
        }
      }

      if (res?._openrouter_error) {
        toast(`IA dégradée : ${res._openrouter_error}`, 'warning')
      }
    } catch (e) {
      console.error('Erreur analyze_mood:', e)
    } finally {
      setIsAnalyzing(false)
    }
  }, [text, liveText, history, isAnalyzing, buildCardPositions, mergePetals, mergePetalsDeficit, revealCards, dreamscapeConfig])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleSave = useCallback(async () => {
    if (!history.length && !poeticReflection?.trim()) {
      toast(t('dreamscapeCanvas.noReflection'), 'warning')
      return
    }
    setIsSaving(true)
    try {
      const snapshot = await captureSnapshot()
      const payload = {
        history,
        poeticReflection: poeticReflection?.trim() || null,
        slots: slots.map(s => ({
          position: s.position,
          card: s.card,
          faceDown: s.faceDown,
          angleDeg: s.angleDeg,
          revealOrder: s.revealOrder ?? 0,
          halo: s.halo ?? null,
        })),
        petals: { ...livePetals },
        snapshot: snapshot || undefined,
      }
      if (resumeId) {
        await dreamscapeApi.update(resumeId, payload)
      } else {
        await dreamscapeApi.save(payload)
      }
      toast(t('dreamscapeCanvas.saveSuccess'), 'success')
    } catch (e) {
      toast(e?.message || 'Impossible de sauvegarder', 'error')
    } finally {
      setIsSaving(false)
    }
  }, [history, poeticReflection, slots, livePetals, resumeId, captureSnapshot])

  const handleCloseAndSave = useCallback(async () => {
    if (!history.length && !poeticReflection?.trim()) {
      toast(t('dreamscapeCanvas.noReflection'), 'warning')
      return
    }
    setIsSaving(true)
    try {
      const pathCards = slots
        .filter(s => !s.faceDown)
        .sort((a, b) => (a.revealOrder || 0) - (b.revealOrder || 0))
        .map(s => s.card)
      let synthesis = ''
      let sections: any = null
      try {
        const sumRes = await aiApi.dreamscapeSummarize({
          history,
          slots: slots.map(s => ({ position: s.position, card: s.card, faceDown: s.faceDown })),
          petals: livePetals,
          path: pathCards,
          actions: closingActions,
        })
        synthesis = sumRes?.summary?.trim() || poeticReflection?.trim() || ''
        sections = sumRes?.sections ?? null
      } catch {
        synthesis = poeticReflection?.trim() || ''
      }
      const closingEntry = { role: 'closing', content: synthesis, actions: closingActions, path: pathCards }
      const snapshot = await captureSnapshot()
      const payload = {
        history: [...history, closingEntry],
        poeticReflection: synthesis || poeticReflection?.trim() || null,
        slots: slots.map(s => ({
          position: s.position,
          card: s.card,
          faceDown: s.faceDown,
          angleDeg: s.angleDeg,
          revealOrder: s.revealOrder ?? 0,
          halo: s.halo ?? null,
        })),
        petals: { ...livePetals },
        snapshot: snapshot || undefined,
      }
      let savedId: number | null = null
      if (resumeId) {
        const r = await dreamscapeApi.update(resumeId, payload) as any
        savedId = Number(r?.id ?? resumeId)
      } else {
        const r = await dreamscapeApi.save(payload) as any
        savedId = Number(r?.id ?? null)
      }
      setCloseModalSynthesis(synthesis)
      setCloseModalSections(sections)
      setCloseModalSavedId(savedId)
      setCloseModalStage('saved')
      setShowCloseModal(true)

      if (savedId) {
        try {
          const shareRes = await dreamscapeApi.share(String(savedId)) as any
          const base = getShareBaseUrl()
          const fullUrl = `${base}${shareRes?.shareUrl || `/dreamscape/partage/${shareRes?.shareToken}`}`
          setCloseModalShareUrl(fullUrl)
        } catch {
          setCloseModalShareUrl(null)
        }
      }

      toast(t('dreamscapeCanvas.closeSuccess'), 'success')
    } catch (e) {
      toast(e?.message || 'Impossible de sauvegarder', 'error')
      setShowCloseModal(true)
    } finally {
      setIsSaving(false)
    }
  }, [history, poeticReflection, slots, livePetals, closingActions, router, resumeId, captureSnapshot])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.1 },
    },
    exit: { opacity: 0 },
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0 },
  }

  return (
    <div className="relative w-full h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-behavior-y-contain bg-gradient-to-b from-slate-900 via-violet-950/40 to-slate-900" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Contenu scrollable — rosace centrée en haut, puis formulaire */}
      <motion.div
        className="flex flex-col items-center w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-5 gap-4 sm:gap-5"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
      {/* Visuel : rosace + fleur — centré, compact, halo lumineux */}
      <motion.div variants={itemVariants} className="shrink-0 flex justify-center w-full">
        <div
          ref={snapshotRef}
          className="relative w-[min(100%,360px)] aspect-square max-w-[360px] overflow-hidden rounded-xl p-5 sm:p-6 shadow-[0_0_40px_rgba(59,20,120,0.35)]"
          style={{ backgroundColor: '#05030c' }}
          data-dreamscape-snapshot
        >
          <div className="absolute inset-0 z-0 bg-[#05030c]" aria-hidden />
          <div
            className="absolute inset-0 z-0"
            style={{
              background:
                'radial-gradient(ellipse 76% 60% at 50% 46%, rgba(124,58,237,0.2) 0%, transparent 64%), linear-gradient(165deg, #07051c 0%, #120a24 50%, #05030c 100%)',
            }}
            aria-hidden
          />
          <div className="absolute inset-5 sm:inset-6 z-10 flex items-center justify-center">
            <DreamscapeRosace
              cards={rosaceCards}
              className="w-full h-full max-w-full max-h-full"
              onCardHover={!isTouchDevice ? (ev) => setHoveredCardPosition(ev?.position ?? null) : undefined}
              onCardClick={({ cardName }) => {
                try {
                  const card = findCard(cardName)
                  if (card) setSelectedCard({ card })
                } catch (err) {
                  console.error('[Dreamscape] card click error:', err)
                }
              }}
            />
          </div>
          <div className="absolute inset-5 sm:inset-6 pointer-events-none z-[15] flex items-center justify-center">
            <div
              className="absolute left-1/2 top-1/2 transition-opacity duration-1000"
              style={{ transform: `translate(calc(-50% + ${FLOWER_OFFSET.x}px), calc(-50% + ${FLOWER_OFFSET.y}px))` }}
            >
              {/* Fleur ombre (arrière-plan) — bleu-gris pour contraster avec la lumière (vert) */}
              <div className="absolute inset-0 flex items-center justify-center opacity-50">
                <FlowerSVG
                  petals={FULL_SILHOUETTE_PETALS}
                  variant="ombre"
                  animate={false}
                  size={240}
                  showLabels={false}
                  showScores={false}
                />
              </div>
              {/* Fleur dynamique : PC = tooltip au survol des CARTES, mobile = bouton bascule */}
              <div className="relative opacity-80">
                <FlowerSVG
                  petals={livePetals}
                  petalsDeficit={livePetalsDeficit}
                  animate={true}
                  size={240}
                  showLabels={isTouchDevice ? labelsToggled : false}
                  showScores={false}
                  labelsOnHoverOnly={!isTouchDevice}
                  highlightedPetalId={!isTouchDevice ? positionToPetalId(hoveredCardPosition) : null}
                  labelDistance={125}
                  forceDualStyle={true}
                />
              </div>
            </div>
          </div>
          {isTouchDevice && (
            <button
              type="button"
              onClick={() => setLabelsToggled(v => !v)}
              className="absolute top-5 left-5 sm:top-6 sm:left-6 z-20 text-xs text-white/60 hover:text-white/90 underline underline-offset-2 transition-colors pointer-events-auto"
            >
              {labelsToggled ? t('dreamscapeCanvas.hideLabels') : t('dreamscapeCanvas.showLabels')}
            </button>
          )}
        </div>
      </motion.div>

      {/* Bloc conversation — texte IA, zone de saisie, boutons */}
      <motion.div variants={itemVariants} className="relative z-20 w-full flex flex-col items-center gap-3 sm:gap-4 pb-6 sm:pb-8">

        {/* Phrase de l'IA */}
        <motion.p
          key={poeticReflection}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className={[
            'text-white/90 font-serif text-center leading-relaxed drop-shadow-lg min-h-[2rem] w-full',
            !poeticReflection || poeticReflection.length < 60
              ? 'text-xl sm:text-2xl'
              : poeticReflection.length < 110
              ? 'text-lg sm:text-xl'
              : poeticReflection.length < 160
              ? 'text-base sm:text-lg'
              : 'text-sm sm:text-base',
          ].join(' ')}
        >
          {isAnalyzing && !poeticReflection ? '…' : poeticReflection}
        </motion.p>

        {/* Alerte ombre — code couleur par niveau */}
        {shadowState?.detected && !shadowDismissed && (() => {
          const level = shadowState.level ?? 1
          const p = level >= 4
            ? { border: 'border-red-600', bg: 'bg-red-950/80', icon: '🔴', label: t('dreamscapeCanvas.distress'), labelColor: 'text-red-300', cardColor: 'text-red-300', ctaBg: 'bg-red-900/60 border-red-700/50', ctaText: 'text-red-200', btn: 'bg-red-600 hover:bg-red-500', pulse: true }
            : level >= 3
            ? { border: 'border-rose-700', bg: 'bg-rose-950/80', icon: '🌑', label: t('dreamscapeCanvas.strongShadow'), labelColor: 'text-rose-300', cardColor: 'text-rose-300', ctaBg: 'bg-rose-900/50 border-rose-700/40', ctaText: 'text-rose-200', btn: 'bg-rose-600 hover:bg-rose-500', pulse: false }
            : level >= 2
            ? { border: 'border-orange-600', bg: 'bg-orange-950/80', icon: '🌘', label: t('dreamscapeCanvas.notableTension'), labelColor: 'text-orange-300', cardColor: 'text-orange-300', ctaBg: 'bg-orange-900/40 border-orange-700/40', ctaText: 'text-orange-200', btn: 'bg-orange-600 hover:bg-orange-500', pulse: false }
            : { border: 'border-amber-600', bg: 'bg-amber-950/80', icon: '🌗', label: t('dreamscapeCanvas.lightShadow'), labelColor: 'text-amber-300', cardColor: 'text-amber-300', ctaBg: 'bg-amber-900/30 border-amber-700/30', ctaText: 'text-amber-200', btn: 'bg-amber-600 hover:bg-amber-500', pulse: false }
          return (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`w-full rounded-2xl ${p.bg} border ${p.border} backdrop-blur-md p-3 space-y-2 ${p.pulse ? 'ring-2 ring-red-500/40' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base shrink-0">{p.icon}</span>
                  <p className={`text-xs font-bold uppercase tracking-wider ${p.labelColor}`}>{p.label}</p>
                  <span className={`text-[10px] font-mono ml-1 ${p.labelColor} opacity-60`}>N{level}</span>
                </div>
                <button
                  onClick={() => setShadowDismissed(true)}
                  className="text-slate-500 hover:text-slate-300 text-xs px-1"
                  aria-label={t('dreamscapeCanvas.close')}>✕</button>
              </div>
              {shadowState.card && (
                <p className={`text-xs ${p.cardColor} leading-relaxed`}>
                  {t('dreamscapeCanvas.anchor')} : <strong>{shadowState.card}</strong>
                </p>
              )}
              {level >= 3 && (
              <div className={`rounded-xl ${p.ctaBg} border p-2.5 flex items-center justify-between gap-3`}>
                <p className={`text-xs ${p.ctaText} leading-relaxed`}>
                  {level >= 4 ? t('dreamscapeCanvas.accompanyDistress') : t('dreamscapeCanvas.accompanyLight')}
                </p>
                <Link
                  href="/coaches"
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg ${p.btn} text-white text-xs font-semibold transition-colors whitespace-nowrap`}>
                  {t('dreamscapeCanvas.accompany')}
                </Link>
              </div>
              )}
            </motion.div>
          )
        })()}

        {/* Zone de saisie */}
        <div className="w-full bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl p-1 shadow-xl border border-white/10">
          <VoiceTextInput
            value={text}
            onChange={setText}
            onLiveUpdate={setLiveText}
            autoStart={false}
            placeholder={t('dreamscapeCanvas.placeholder')}
            className="text-white placeholder-white/40 text-base sm:text-lg"
            rows={2}
            loading={isAnalyzing}
            loadingText={t('dreamscapeCanvas.listening')}
            onKeyDown={handleKeyDown}
            micAddon={(() => {
              const turns = history.filter(m => m.role === 'user').length
              const max = Number(dreamscapeConfig?.max_echanges ?? 0)
              const label = max > 0 ? `${Math.min(turns, max)}/${max}` : String(turns)
              return (
                <span className="inline-flex items-center h-11 px-3 rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-white/80">
                  Échanges&nbsp;: {label}
                </span>
              )
            })()}
          />
        </div>

        {/* Boutons : principal + secondaires regroupés */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isAnalyzing || !(liveText || text).trim()}
              onClick={sendMessage}
              className="px-6 py-2 sm:px-8 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-violet-600 to-rose-500 rounded-full text-white font-medium shadow-lg hover:shadow-xl transition-all border border-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? t('dreamscapeCanvas.listening') : t('dreamscapeCanvas.sendBtn')}
            </motion.button>
            {canCloseTirage && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCloseModal(true)}
                disabled={isSaving}
                className="px-4 py-2 rounded-full text-sm font-medium bg-emerald-600/90 hover:bg-emerald-500 text-white border border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title={t('dreamscapeCanvas.closeWalkTitle')}
              >
                {t('dreamscapeCanvas.closeWalkBtn')}
              </motion.button>
            )}
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-1.5 py-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={(!history.length && !poeticReflection?.trim()) || isSaving}
              className="px-3 py-1.5 rounded-full text-xs font-medium border-0 bg-transparent text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title={t('dreamscapeCanvas.saveTitle')}
            >
              {isSaving ? '…' : t('dreamscapeCanvas.saveBtn')}
            </motion.button>
            <span className="w-px h-4 bg-white/20" aria-hidden />
            <button
              type="button"
              onClick={async () => {
                setIsCapturing(true)
                try {
                  const dataUrl = await captureSnapshot()
                  if (dataUrl) {
                    const a = document.createElement('a')
                    a.href = dataUrl
                    a.download = `promenade-onirique-${Date.now()}.png`
                    a.click()
                    toast(t('share.imageDownloaded'), 'success')
                  }
                } catch {
                  toast(t('share.exportError'), 'error')
                } finally {
                  setIsCapturing(false)
                }
              }}
              disabled={isCapturing}
              className="px-3 py-1.5 rounded-full text-xs font-medium border-0 bg-transparent text-white/70 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
              title={t('dreamscapeCanvas.captureTitle')}
            >
              {isCapturing ? '…' : t('dreamscapeCanvas.captureBtn')}
            </button>
            <span className="w-px h-4 bg-white/20" aria-hidden />
            <Link
              href="/dreamscape/historique"
              className="px-3 py-1.5 rounded-full text-xs font-medium border-0 bg-transparent text-white/70 hover:text-white hover:bg-white/10 transition-all"
              title={t('dreamscapeCanvas.historyTitle')}
            >
              {t('dreamscapeCanvas.historyBtn')}
            </Link>
          </div>
        </div>

      </motion.div>
      </motion.div>

      {/* Modal zoom carte — détails + mini explication (inline, pas de portal) */}
      {selectedCard?.card ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
          onClick={() => setSelectedCard(null)}
          role="dialog"
          aria-modal="true"
          aria-label={selectedCard.card.name}
          style={{ left: 0, right: 0, top: 0, bottom: 0 }}>
          <div
            className="relative flex flex-col items-center gap-4 max-w-2xl w-full"
            onClick={e => e.stopPropagation()}>
            {selectedCard.card.img ? (
              <img
                src={cardImageUrl(selectedCard.card.img) || selectedCard.card.img}
                alt={selectedCard.card.name || ''}
                className="max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-xl shadow-2xl"
                style={{ maxHeight: 'min(70vh, 540px)' }}
                onError={e => { e.target.style.display = 'none' }}
              />
            ) : null}
            <div className="rounded-xl bg-white dark:bg-[#0f172a] px-5 py-4 w-full text-center shadow-xl border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{selectedCard.card.name || ''}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 italic mt-2 leading-relaxed">
                {(getCardTranslated(selectedCard.card, locale || 'fr')?.synth) ||
                  ((getCardTranslated(selectedCard.card, locale || 'fr')?.desc) || '').split('\n')[0] ||
                  ''}
              </p>
              <p className="text-xs text-slate-400 mt-3">{t('session.zoomCardClose')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedCard(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:opacity-90 shadow-lg z-10"
            aria-label={t('common.close')}>
            ✕
          </button>
        </div>
      ) : null}

      {/* Modal proposition de clôture */}
      {showCloseModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
          onClick={() => {
            // Si la clôture est forcée, on ne permet pas d'annuler.
            if (forcedCloseActive) return
            // Si déjà enregistré (écran résumé), fermer = repartir sur une promenade vierge.
            // Sinon, fermer = continuer la promenade en cours.
            if (closeModalStage === 'saved') resetWalk()
            else setShowCloseModal(false)
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-modal-title"
          style={{ left: 0, right: 0, top: 0, bottom: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative flex flex-col gap-5 max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl bg-[#1e293b]"
            onClick={e => e.stopPropagation()}
          >
            <h2 id="close-modal-title" className="text-lg sm:text-xl font-bold text-white">
              {t('dreamscapeCanvas.closeModalTitle')}
            </h2>
            <p className="text-sm text-white/80 leading-relaxed">
              {hardCloseMessage?.trim() ? hardCloseMessage : t('dreamscapeCanvas.closeModalDesc')}
            </p>
            <div className="rounded-xl bg-slate-800/60 border border-white/10 p-3">
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                Parcours
              </p>
              <p className="text-sm text-white/90">
                {history.filter(m => m.role === 'user').length} échange(s) · {slots.filter(s => !s.faceDown).length} carte(s) révélée(s)
              </p>
            </div>
            {slots.some(s => !s.faceDown) && (
              <div className="rounded-xl bg-slate-800/90 border border-white/10 p-3">
                <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                  {t('dreamscapeCanvas.pathLabel')}
                </p>
                <p className="text-sm text-white/90">
                  {slots.filter(s => !s.faceDown).map(s => s.card).join(' → ')}
                </p>
              </div>
            )}
            {closingActions.length > 0 && (
              <div className="rounded-xl bg-slate-800/90 border border-white/10 p-3">
                <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                  {t('dreamscapeCanvas.actionsLabel')}
                </p>
                <ul className="text-sm text-white/90 space-y-1 list-disc list-inside">
                  {closingActions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {closeModalStage === 'saved' && closeModalSynthesis?.trim() && (
              <div className="rounded-xl bg-slate-800/90 border border-white/10 p-3">
                <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                  Ce qui s’est joué
                </p>
                {closeModalSections ? (
                  <div className="space-y-3">
                    {closeModalSections.intention_depart ? (
                      <div>
                        <p className="text-[11px] font-bold text-violet-200 uppercase tracking-wider mb-1">Intention de départ</p>
                        <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{String(closeModalSections.intention_depart)}</p>
                      </div>
                    ) : null}
                    {closeModalSections.ce_qui_a_emerge ? (
                      <div>
                        <p className="text-[11px] font-bold text-violet-200 uppercase tracking-wider mb-1">Ce qui a émergé</p>
                        <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{String(closeModalSections.ce_qui_a_emerge)}</p>
                      </div>
                    ) : null}
                    {closeModalSections.trajectoire_cartes ? (
                      <div>
                        <p className="text-[11px] font-bold text-violet-200 uppercase tracking-wider mb-1">Trajectoire & cartes</p>
                        <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{String(closeModalSections.trajectoire_cartes)}</p>
                      </div>
                    ) : null}
                    {Array.isArray(closeModalSections.citations) && closeModalSections.citations.length ? (
                      <div>
                        <p className="text-[11px] font-bold text-violet-200 uppercase tracking-wider mb-1">Citations</p>
                        <ul className="text-sm text-white/90 space-y-1 list-disc list-inside">
                          {closeModalSections.citations.slice(0, 4).map((q: string, i: number) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {Array.isArray(closeModalSections.actions_a_oeuvrer) && closeModalSections.actions_a_oeuvrer.length ? (
                      <div>
                        <p className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider mb-1">Actions à œuvrer</p>
                        <ul className="text-sm text-white/90 space-y-1 list-disc list-inside">
                          {closeModalSections.actions_a_oeuvrer.slice(0, 4).map((a: string, i: number) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                    {closeModalSynthesis.trim()}
                  </p>
                )}
              </div>
            )}
            {closeModalPreview && (
              <div className="rounded-xl bg-slate-900/80 border border-violet-500/25 p-3">
                <p className="text-xs font-semibold text-violet-300/90 uppercase tracking-wider mb-2">
                  {t('dreamscapeHistorique.snapshot')}
                </p>
                <img
                  src={closeModalPreview}
                  alt=""
                  className="w-full max-w-[240px] mx-auto rounded-lg object-contain ring-1 ring-white/10 shadow-lg"
                />
              </div>
            )}
            {closeModalStage === 'saved' && closeModalShareUrl && (
              <div className="rounded-xl bg-slate-900/60 border border-white/10 p-3">
                <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                  Partage
                </p>
                {(() => {
                  const raw =
                    (closeModalSections?.intention_depart as string) ||
                    (closeModalSections?.ce_qui_a_emerge as string) ||
                    closeModalSynthesis ||
                    ''
                  const oneLine = String(raw).replace(/\s+/g, ' ').trim()
                  const snippet = oneLine.length > 180 ? oneLine.slice(0, 179) + '…' : oneLine
                  const actions = Array.isArray(closeModalSections?.actions_a_oeuvrer)
                    ? closeModalSections.actions_a_oeuvrer.filter(Boolean).slice(0, 2)
                    : []
                  const actionsTxt = actions.length ? ` Actions: ${actions.join(' / ')}` : ''
                  const text = (snippet ? `« ${snippet} »` : 'Ma promenade onirique.') + actionsTxt
                  return (
                <ShareSocialButtons
                  payload={{
                    url: closeModalShareUrl,
                    title: 'Ma Promenade Onirique — Fleur d\'AmOurs',
                    text,
                  }}
                  variant="labels"
                />
                  )
                })()}
                <p className="mt-2 text-[11px] text-white/50 leading-relaxed">
                  Twitter/WhatsApp reprennent le texte ci-dessus. Facebook/LinkedIn utilisent surtout le titre, l&apos;image et la description de la page partagée.
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-3 justify-end">
              {closeModalStage === 'saved' ? (
                <button
                  type="button"
                  onClick={() => resetWalk()}
                  className="px-4 py-2 rounded-full text-sm font-medium border border-white/30 bg-white/10 text-white/90 hover:bg-white/20"
                >
                  {t('common.close')}
                </button>
              ) : forcedCloseActive ? null : (
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 rounded-full text-sm font-medium border border-white/30 bg-white/10 text-white/90 hover:bg-white/20"
                >
                  {t('common.cancel')}
                </button>
              )}
              {closeModalStage !== 'saved' && (
                <button
                  type="button"
                  onClick={handleCloseAndSave}
                  disabled={isSaving}
                  className="px-5 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-violet-600 to-rose-500 text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? '…' : t('dreamscapeCanvas.closeConfirm')}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Nudge doux : proposer de clôturer sans être agressif */}
      {showCloseNudge && !showCloseModal && (
        <div
          className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCloseNudge(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Proposition de clôture"
          style={{ left: 0, right: 0, top: 0, bottom: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-lg rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl bg-[#0b1020]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-violet-300/90 uppercase tracking-wider">
                  Un seuil de clôture
                </p>
                <h3 className="text-lg font-bold text-white mt-1">
                  Veux-tu sceller cette promenade ?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseNudge(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 text-white/80 flex items-center justify-center"
                aria-label={t('common.close')}
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {(() => {
                const lastUser = [...history].reverse().find((m) => m.role === 'user')?.content
                const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant')?.content
                const recap = (lastAssistant || poeticReflection || '').trim()
                return (
                  <>
                    {lastUser ? (
                      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">Tes mots</p>
                        <p className="text-sm text-white/90 leading-relaxed">
                          {String(lastUser).slice(0, 220)}{String(lastUser).length > 220 ? '…' : ''}
                        </p>
                      </div>
                    ) : null}
                    {recap ? (
                      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">Ce qui émerge</p>
                        <p className="text-sm text-white/90 leading-relaxed">
                          {recap.slice(0, 260)}{recap.length > 260 ? '…' : ''}
                        </p>
                      </div>
                    ) : null}
                  </>
                )
              })()}

              {closingActions?.length ? (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <p className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-2">
                    Pistes d’action (ce que tu as envie d’œuvrer)
                  </p>
                  <ul className="text-sm text-white/90 space-y-1 list-disc list-inside">
                    {closingActions.slice(0, 3).map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCloseNudge(false)}
                className="px-4 py-2 rounded-full text-sm font-medium border border-white/25 bg-white/5 text-white/90 hover:bg-white/10"
              >
                Continuer l’exploration
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseNudge(false)
                  setShowCloseModal(true)
                }}
                className="px-5 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-violet-600 to-rose-500 text-white hover:opacity-90"
              >
                Clôturer maintenant
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
