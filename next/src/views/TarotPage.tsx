'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import {
  ALL_CARDS,
  FOUR_DOORS,
  BACK_IMG,
  getCardTranslated,
  getDoorTranslated,
} from '@/data/tarotCards'
import { VoiceTextInput } from '@/components/VoiceTextInput'
import { BuyTarotCTA } from '@/components/BuyTarotCTA'
import { useAuth } from '@/contexts/AuthContext'
import { tarotReadingsApi } from '@/api/tarotReadings'
import { billingApi } from '@/api/billing'
import { toast } from '@/hooks/useToast'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ShareTirageButton } from '@/components/ShareTirageButton'
import { PETAL_ORDER } from '@/lib/petal-tarot'

const STATE = {
  IDLE: 'idle',
  SPINNING: 'spinning',
  REVEALING: 'revealing',
  OPENING: 'opening',
  REVEALED: 'revealed',
}

function useReadings() {
  const { user } = useAuth()
  const storageKey = 'tarot_readings_' + (user?.id ?? 'anon')
  const [readings, setReadings] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(!!user?.id)

  useEffect(() => {
    if (user?.id) {
      setLoading(true)
      tarotReadingsApi
        .my()
        .then((res: unknown) =>
          setReadings((res as { items?: Record<string, unknown>[] })?.items || [])
        )
        .catch(() => setReadings([]))
        .finally(() => setLoading(false))
    } else {
      try {
        const raw = localStorage.getItem(storageKey)
        setReadings(raw ? JSON.parse(raw) : [])
      } catch {
        setReadings([])
      }
    }
  }, [user?.id, storageKey])

  const addReading = useCallback(
    async (r: Record<string, unknown>) => {
      if (user?.id) {
        try {
          const saved = (await tarotReadingsApi.save({
            type: (r.type as string) ?? 'simple',
            payload: r,
          })) as { id?: number }
          const item = { ...r, ...saved, id: String(saved.id) }
          setReadings((prev) => [item, ...prev])
          return String(saved.id)
        } catch (err: unknown) {
          const e = err as { status?: number; code?: string }
          if (e?.status === 402 || e?.code === 'quota_exceeded') {
            throw err
          }
          console.error('[tarot] save API failed:', e)
        }
      }
      const id =
        (typeof crypto !== 'undefined' && crypto.randomUUID?.()) ||
        `t-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const item = { ...r, id, createdAt: new Date().toISOString() }
      setReadings((prev) => {
        const next = [item, ...prev]
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {}
        return next
      })
      return id
    },
    [storageKey, user?.id]
  )

  const updateReading = useCallback(
    (id: string, updates: Record<string, unknown>) => {
      const isServerId = /^\d+$/.test(String(id))
      if (user?.id && isServerId) {
        setReadings((prev) => {
          const reading = prev.find((r) => String((r as { id?: string }).id) === String(id))
          if (reading) {
            const merged = { ...reading, ...updates } as Record<string, unknown>
            tarotReadingsApi.update(id, merged).catch(() => {})
            return prev.map((r) =>
              String((r as { id?: string }).id) === String(id) ? merged : r
            )
          }
          return prev
        })
      } else {
        setReadings((prev) => {
          const next = prev.map((r) =>
            (r as { id?: string }).id === id ? { ...r, ...updates } : r
          )
          try {
            localStorage.setItem(storageKey, JSON.stringify(next))
          } catch {}
          return next
        })
      }
    },
    [storageKey, user?.id]
  )

  const deleteReading = useCallback(
    (id: string) => {
      const isServerId = /^\d+$/.test(String(id))
      if (user?.id && isServerId) {
        tarotReadingsApi.delete(id).then(() => {
          setReadings((prev) =>
            prev.filter((r) => String((r as { id?: string }).id) !== String(id))
          )
        }).catch(() => {})
      } else {
        setReadings((prev) => {
          const next = prev.filter((r) => (r as { id?: string }).id !== id)
          try {
            localStorage.setItem(storageKey, JSON.stringify(next))
          } catch {}
          return next
        })
      }
    },
    [storageKey, user?.id]
  )

  return { readings, loading, addReading, updateReading, deleteReading }
}

function Particles({
  active,
  color = '#a78bfa',
}: {
  active: boolean
  color?: string
}) {
  if (!active) return null
  const particles = Array.from({ length: 28 }, (_, i) => i)
  const sparkles = Array.from({ length: 12 }, (_, i) => i)
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ zIndex: 10 }}
    >
      {particles.map((i) => {
        const angle = (i / particles.length) * 360 + (i % 3) * 15
        const dist = 70 + Math.random() * 90
        const size = 5 + Math.random() * 8
        const delay = Math.random() * 0.2
        const dur = 0.8 + Math.random() * 0.5
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: size,
              height: size,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 ${size * 3}px ${color}, 0 0 ${size}px rgba(255,255,255,0.6)`,
              animation: `particle-fly ${dur}s ${delay}s ease-out forwards`,
              // @ts-expect-error CSS custom property
              '--angle': `${angle}deg`,
              '--dist': `${dist}px`,
            }}
          />
        )
      })}
      {sparkles.map((i) => {
        const angle = (i / sparkles.length) * 360 + 30
        const dist = 50 + Math.random() * 80
        const size = 2 + Math.random() * 3
        const delay = 0.1 + Math.random() * 0.25
        const dur = 0.5 + Math.random() * 0.4
        return (
          <div
            key={`s-${i}`}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: size,
              height: size,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.9)',
              boxShadow: `0 0 ${size * 4}px white`,
              animation: `particle-fly ${dur}s ${delay}s ease-out forwards`,
              // @ts-expect-error CSS custom property
              '--angle': `${angle}deg`,
              '--dist': `${dist}px`,
            }}
          />
        )
      })}
    </div>
  )
}

function EnergyRing({
  active,
  color = 'rgba(167,139,250,0.6)',
}: {
  active: boolean
  color?: string
}) {
  if (!active) return null
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: -20,
          borderRadius: 24,
          border: `2px solid ${color}`,
          animation: 'ring-expand 0.8s ease-out forwards',
          pointerEvents: 'none',
          zIndex: 9,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: -40,
          borderRadius: 28,
          border: `1px solid ${color}`,
          opacity: 0.4,
          animation: 'ring-expand 0.8s 0.1s ease-out forwards',
          pointerEvents: 'none',
          zIndex: 8,
        }}
      />
    </>
  )
}

type CardType = { name: string; desc?: string; img?: string; synth?: string }

function FlipCard({
  card,
  spinning,
  spinName,
  size = 'md',
  revealDelay = 0,
  glowColor = '#a78bfa',
  preRevealDance = false,
}: {
  card: CardType | null
  spinning: boolean
  spinName: string
  size?: 'sm' | 'md'
  revealDelay?: number
  glowColor?: string
  preRevealDance?: boolean
}) {
  const [flipped, setFlipped] = useState(false)
  const [particles, setParticles] = useState(false)
  const [ring, setRing] = useState(false)
  const [shimmer, setShimmer] = useState(false)
  const prevCard = useRef<CardType | null>(null)

  useEffect(() => {
    if (card && card !== prevCard.current) {
      prevCard.current = card
      setFlipped(false)
      setParticles(false)
      setRing(false)
      setShimmer(false)
      const t1 = setTimeout(() => {
        setFlipped(true)
        setParticles(true)
        setRing(true)
      }, revealDelay + 80)
      const t2 = setTimeout(() => setParticles(false), revealDelay + 1600)
      const t3 = setTimeout(() => {
        setRing(false)
        setShimmer(true)
      }, revealDelay + 900)
      const t4 = setTimeout(() => setShimmer(false), revealDelay + 2400)
      return () => [t1, t2, t3, t4].forEach(clearTimeout)
    }
    if (!card) {
      setFlipped(false)
      setParticles(false)
      setRing(false)
      setShimmer(false)
    }
  }, [card, revealDelay])

  const w = size === 'sm' ? 150 : 210
  const h = size === 'sm' ? 225 : 315

  return (
    <div style={{ width: w, height: h, perspective: 1100, position: 'relative' }}>
      <Particles active={particles} color={glowColor} />
      <EnergyRing active={ring} color={glowColor + '99'} />

      {(spinning || preRevealDance || (card && !flipped)) && (
        <div
          style={{
            position: 'absolute',
            inset: -8,
            borderRadius: 20,
            background: `radial-gradient(ellipse at center, ${glowColor}33 0%, transparent 70%)`,
            animation: 'glow-pulse 0.9s ease-in-out infinite alternate',
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'none',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
          animation: spinning
            ? 'card-float 1.8s ease-in-out infinite'
            : preRevealDance || (card && !flipped)
              ? 'card-pre-reveal 2s ease-in-out'
              : flipped
                ? 'card-flip-arc 1s cubic-bezier(0.25,0.46,0.45,0.94) forwards, card-land 0.5s ease-out 1s forwards, card-dance 2s ease-in-out 1.55s forwards'
                : 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          <img
            src={BACK_IMG}
            alt="dos"
            className="w-full h-full object-cover rounded-2xl"
            style={{
              boxShadow:
                spinning || preRevealDance || (card && !flipped)
                  ? `0 0 30px ${glowColor}88, 0 12px 40px rgba(0,0,0,0.3)`
                  : '0 8px 30px rgba(0,0,0,0.25)',
              transition: 'box-shadow 0.3s ease',
            }}
          />
          {spinning && spinName && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-end pb-4 rounded-2xl"
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)',
                animation: 'name-cycle 0.08s ease',
              }}
            >
              <span className="text-white font-semibold text-xs text-center px-3 leading-tight text-[length:inherit]">
                {spinName}
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {card && (
            <>
              <img
                src={card.img}
                alt={card.name}
                className="w-full h-full object-cover rounded-2xl"
                style={{
                  boxShadow: `0 0 40px ${glowColor}66, 0 16px 48px rgba(0,0,0,0.35)`,
                }}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = BACK_IMG
                }}
              />
              {shimmer && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 16,
                    overflow: 'hidden',
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '-100%',
                      width: '60%',
                      height: '100%',
                      background:
                        'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%)',
                      animation: 'shimmer-sweep 0.9s ease-out forwards',
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SimpleDraw({
  onReadingComplete,
  currentReadingId,
  onSaveReflection,
  quotaExceeded,
  landingCard,
  initialIntention,
  petalFlow = false,
}: {
  onReadingComplete?: (data: Record<string, unknown>) => void | Promise<unknown>
  currentReadingId: string | null
  onSaveReflection?: (id: string, updates: Record<string, unknown>) => void
  quotaExceeded: boolean
  landingCard?: CardType | null
  /** Suggestion préremplie (ex. depuis un pétale) — modifiable avant le tirage */
  initialIntention?: string
  /** Flux fleur : pas de carte imposée ; compte à rebours doux optionnel */
  petalFlow?: boolean
}) {
  const locale = useStore((s) => s.locale)
  const { user } = useAuth()
  const [intention, setIntention] = useState('')
  const [frozenIntention, setFrozenIntention] = useState('')
  const [drawState, setDrawState] = useState(STATE.IDLE)
  const [drawnCard, setDrawnCard] = useState<CardType | null>(null)
  const [bgPulse, setBgPulse] = useState(false)
  const [contentReady, setContentReady] = useState(false)
  const [interpretLoading, setInterpretLoading] = useState(false)
  const [interpretation, setInterpretation] = useState('')
  const [autoSecLeft, setAutoSecLeft] = useState<number | null>(null)
  const [userCancelledAuto, setUserCancelledAuto] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const indexRef = useRef(0)
  const landingHandledRef = useRef(false)
  const initialIntentionRef = useRef('')
  const startDrawRef = useRef<() => void>(() => {})

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  useEffect(() => {
    if (initialIntention == null || initialIntention === '') return
    setIntention(initialIntention)
    if (petalFlow) initialIntentionRef.current = initialIntention
  }, [initialIntention, petalFlow])

  // Pré-sélectionner la carte de la landing page sans animation
  useEffect(() => {
    if (!landingCard || landingHandledRef.current || drawState !== STATE.IDLE) return
    landingHandledRef.current = true
    setDrawnCard(landingCard)
    setDrawState(STATE.REVEALED)
    // Sauvegarder automatiquement ce tirage comme les autres
    const cardT = getCardTranslated(landingCard, locale) || landingCard
    onReadingComplete?.({
      type: 'simple',
      card: {
        name: cardT.name ?? '',
        desc: cardT.desc,
        img: landingCard.img,
        synth: cardT.synth,
      },
      intention: '',
      reflection: '',
    })
  }, [landingCard, drawState, locale])

  useEffect(() => {
    if (drawState === STATE.REVEALED && drawnCard) {
      const t = setTimeout(() => setContentReady(true), 1600)
      return () => clearTimeout(t)
    }
    setContentReady(false)
  }, [drawState, drawnCard])

  useEffect(() => {
    if (
      !contentReady ||
      !drawnCard ||
      !user?.id ||
      interpretLoading ||
      interpretation
    )
      return
    const cardT = getCardTranslated(drawnCard, locale)
    setInterpretLoading(true)
    const intentForAi = (frozenIntention.trim() || intention.trim()) || undefined
    tarotReadingsApi
      .interpret({
        type: 'simple',
        intention: intentForAi,
        cards: [
          {
            name: (cardT || drawnCard).name,
            desc: (cardT || drawnCard).desc,
            synth: (cardT || drawnCard).synth,
          },
        ],
      })
      .then((res: unknown) => {
        const r = res as { interpretation?: string }
        if (r?.interpretation) setInterpretation(r.interpretation)
      })
      .catch(() => {})
      .finally(() => setInterpretLoading(false))
  }, [contentReady, drawnCard, user?.id, intention, frozenIntention, locale])

  useEffect(() => {
    if (interpretation && currentReadingId && onSaveReflection) {
      onSaveReflection(currentReadingId, { interpretation })
    }
  }, [interpretation, currentReadingId, onSaveReflection])

  function start() {
    setUserCancelledAuto(true)
    setAutoSecLeft(null)
    setFrozenIntention(intention.trim())
    setDrawnCard(null)
    setInterpretation('')
    setDrawState(STATE.SPINNING)
    setBgPulse(true)
    timerRef.current = setInterval(() => {
      const i = Math.floor(Math.random() * ALL_CARDS.length)
      indexRef.current = i
    }, 80)
  }

  startDrawRef.current = start

  const PETAL_AUTO_DRAW_S = 12
  useEffect(() => {
    if (!petalFlow || quotaExceeded || drawState !== STATE.IDLE || userCancelledAuto) {
      setAutoSecLeft(null)
      return undefined
    }
    let left = PETAL_AUTO_DRAW_S
    setAutoSecLeft(left)
    const id = setInterval(() => {
      left -= 1
      if (left <= 0) {
        clearInterval(id)
        setAutoSecLeft(null)
        startDrawRef.current()
        return
      }
      setAutoSecLeft(left)
    }, 1000)
    return () => clearInterval(id)
  }, [petalFlow, quotaExceeded, drawState, userCancelledAuto])

  function stop() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const card = ALL_CARDS[indexRef.current]
    setBgPulse(false)
    setDrawState(STATE.REVEALING)
    setTimeout(() => {
      const intentSnap = intention.trim()
      setFrozenIntention(intentSnap)
      setDrawnCard(card)
      setDrawState(STATE.REVEALED)
      const cardData = {
        name: card.name,
        desc: card.desc,
        img: card.img,
        synth: card.synth,
      }
      onReadingComplete?.({
        type: 'simple',
        card: cardData,
        intention: intentSnap || '',
        reflection: '',
      })
    }, 2000)
  }

  function handle() {
    if (drawState === STATE.SPINNING) return stop()
    return start()
  }

  function reset() {
    setUserCancelledAuto(false)
    if (petalFlow && initialIntentionRef.current) {
      setIntention(initialIntentionRef.current)
    } else {
      setIntention('')
    }
    setFrozenIntention('')
    setDrawnCard(null)
    setDrawState(STATE.IDLE)
    setBgPulse(false)
    setContentReady(false)
    setInterpretation('')
    setInterpretLoading(false)
    setAutoSecLeft(null)
    if (!petalFlow) start()
  }

  return (
    <div className="space-y-6 relative">
      {(bgPulse || drawState === STATE.REVEALING) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            background:
              'radial-gradient(ellipse at center, rgba(139,92,246,0.08) 0%, transparent 70%)',
            animation: 'bg-breathe 2s ease-in-out infinite',
          }}
        />
      )}

      <p className="text-center text-sm text-slate-400 relative z-[1]">
        {ALL_CARDS.length} {t('tarot.cards')} ·{' '}
        {drawState === STATE.IDLE
          ? t('tarot.setIntent')
          : drawState === STATE.SPINNING
            ? t('tarot.cardChoosing')
            : drawState === STATE.REVEALING
              ? t('tarot.cardRevealing')
              : t('tarot.cardSpoke')}
      </p>

      {drawState === STATE.IDLE && (
        <div className="space-y-3 relative z-[1]">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              {t('tarot.intentionLabel')}
            </p>
            <VoiceTextInput
              value={intention}
              onChange={setIntention}
              placeholder={t('tarot.intentionPlaceholder')}
              rows={3}
            />
            <p className="text-[10px] text-slate-400 italic">
              {petalFlow ? t('tarot.petalFlowIntentionHelper') : t('tarot.intentionOptional')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <button
              type="button"
              disabled={quotaExceeded}
              onClick={() => !quotaExceeded && start()}
              className={`w-full sm:w-auto px-8 py-3 rounded-full font-bold text-sm text-white shadow-lg transition-all bg-gradient-to-r from-violet-500 to-accent
                ${quotaExceeded ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-95 active:scale-[0.98]'}`}
              style={{ boxShadow: '0 4px 20px rgba(139,92,246,0.35)' }}
            >
              {t('tarot.launchDraw')}
            </button>
            {petalFlow && autoSecLeft != null && autoSecLeft > 0 && !userCancelledAuto && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-center sm:text-left flex-1 min-w-0">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {t('tarot.petalAutoDrawIn').replace('{n}', String(autoSecLeft))}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setUserCancelledAuto(true)
                    setAutoSecLeft(null)
                  }}
                  className="text-[11px] font-medium text-teal-600 dark:text-teal-400 hover:underline shrink-0"
                >
                  {t('tarot.petalAutoDrawCancel')}
                </button>
              </div>
            )}
          </div>
          {petalFlow && (
            <p className="text-[10px] text-center text-slate-500 dark:text-slate-400">
              {t('tarot.clickCardToDrawHint')}
            </p>
          )}
        </div>
      )}

      {drawState !== STATE.IDLE && (
        <div
          className="rounded-xl border border-violet-200/80 dark:border-violet-800/60 bg-violet-50/50 dark:bg-violet-950/25 px-4 py-3 relative z-[1]"
          aria-readonly="true"
        >
          <p className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-widest mb-1">
            {t('tarot.intentionLabel')}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-200 italic whitespace-pre-wrap">
            {frozenIntention ? `« ${frozenIntention} »` : '—'}
          </p>
        </div>
      )}

      <div className="flex flex-col items-center gap-5 relative z-[1]">
        <div
          onClick={
            !quotaExceeded &&
            drawState !== STATE.REVEALED &&
            drawState !== STATE.REVEALING
              ? handle
              : undefined
          }
          style={{
            cursor:
              !quotaExceeded &&
              drawState !== STATE.REVEALED &&
              drawState !== STATE.REVEALING
                ? 'pointer'
                : 'default',
          }}
        >
          <FlipCard
            card={drawnCard}
            spinning={drawState === STATE.SPINNING}
            spinName=""
            preRevealDance={drawState === STATE.REVEALING}
            glowColor="#a78bfa"
          />
        </div>

        <div className="min-h-8 text-center">
          {(drawState === STATE.SPINNING || drawState === STATE.REVEALING) && (
            <p
              className="text-sm text-slate-400 italic"
              style={{ animation: 'pulse-soft 1.5s ease-in-out infinite' }}
            >
              {drawState === STATE.REVEALING
                ? t('tarot.cardRevealing')
                : t('tarot.focusIntent')}
            </p>
          )}
        </div>
      </div>

      {drawState === STATE.REVEALED && (
        <div className="flex justify-center relative z-[1]">
          <button
            onClick={quotaExceeded ? undefined : reset}
            disabled={quotaExceeded}
            className={`relative px-10 py-3.5 rounded-full font-bold text-sm shadow-lg transition-all overflow-hidden bg-gradient-to-r from-violet-500 to-accent text-white
              ${quotaExceeded ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
            style={{ boxShadow: '0 4px 20px rgba(139,92,246,0.35)' }}
          >
            <span className="relative z-10">{t('tarot.newReading')}</span>
          </button>
        </div>
      )}

      {drawState === STATE.REVEALED && drawnCard && contentReady && (
        <div
          className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/20 dark:to-slate-900 p-6 space-y-2 relative z-[1]"
          style={{
            animation: 'content-rise 0.7s cubic-bezier(.23,1.12,.32,1)',
          }}
        >
          {interpretLoading && (
            <p className="text-sm text-slate-500 dark:text-slate-400 italic">
              {t('tarot.interpretationLoading')}
            </p>
          )}
          {!interpretLoading && interpretation && (
            <>
              <p className="text-xs font-bold text-violet-500 mb-2 uppercase tracking-widest">
                {t('tarot.interpretationTitle')}
              </p>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-line">
                {interpretation}
              </p>
            </>
          )}
          {!interpretLoading && !interpretation && (
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-line">
              {getCardTranslated(drawnCard, locale)?.desc ?? drawnCard.desc}
            </p>
          )}
        </div>
      )}

      {drawState === STATE.REVEALED && drawnCard && contentReady && currentReadingId && (
        <div className="flex justify-center relative z-[1]">
          <ShareTirageButton
            reading={{
              id: currentReadingId,
              type: 'simple',
              card: {
                name: (getCardTranslated(drawnCard, locale) || drawnCard).name ?? '',
                synth: (getCardTranslated(drawnCard, locale) || drawnCard).synth,
              },
              intention: frozenIntention,
              createdAt: new Date().toISOString(),
            }}
            showLabel
          />
        </div>
      )}

      {drawState === STATE.REVEALED && drawnCard && contentReady && (
        <SimpleReflection
          readingId={currentReadingId}
          onSaveReflection={onSaveReflection}
        />
      )}

      <BuyLink show={drawState === STATE.REVEALED} />
    </div>
  )
}

type DoorType = {
  key: string
  group: CardType[]
  title?: string
  subtitle?: string
  aspect?: string
  color: string
  border: string
  glowColor: string
  shadowColor: string
  bgFrom: string
  bgTo: string
}

function FourDoorsDraw({
  onReadingComplete,
  currentReadingId,
  onSaveReflection,
  quotaExceeded,
}: {
  onReadingComplete?: (data: Record<string, unknown>) => void | Promise<unknown>
  currentReadingId: string | null
  onSaveReflection?: (id: string, updates: Record<string, unknown>) => void
  quotaExceeded: boolean
}) {
  const locale = useStore((s) => s.locale)
  const { user } = useAuth()
  const [intention, setIntention] = useState('')
  const [frozenIntention, setFrozenIntention] = useState('')
  const [drawState, setDrawState] = useState(STATE.IDLE)
  const [drawnCards, setDrawnCards] = useState<(CardType | null)[]>([
    null,
    null,
    null,
    null,
  ])
  const [revealedDoors, setRevealedDoors] = useState<number[]>([])
  const [synthesis, setSynthesis] = useState('')
  const [interpretLoading, setInterpretLoading] = useState(false)
  const [interpretation, setInterpretation] = useState('')

  function draw() {
    setFrozenIntention(intention.trim())
    const picked = FOUR_DOORS.map((d) => d.group[Math.floor(Math.random() * d.group.length)])
    setDrawnCards(picked)
    setRevealedDoors([])
    setSynthesis('')
    setInterpretation('')
    setDrawState(STATE.OPENING)
  }

  function startAndReveal(i: number) {
    setFrozenIntention(intention.trim())
    const picked = FOUR_DOORS.map((d) => d.group[Math.floor(Math.random() * d.group.length)])
    setDrawnCards(picked)
    setRevealedDoors([i])
    setSynthesis('')
    setInterpretation('')
    setDrawState(STATE.OPENING)
  }

  function revealDoor(i: number) {
    if (drawState !== STATE.OPENING || revealedDoors.includes(i)) return
    const next = [...revealedDoors, i]
    setRevealedDoors(next)
    if (next.length === 4) {
      const cur = drawnCards
      const [love, vegetal, elements, life] = cur
      const mkTmpl = (key: string, card: CardType | null) => {
        if (!card) return ''
        const ct = getCardTranslated(card, locale) || card
        return t(`tarot.${key}`)
          .replace('{name}', ct.name)
          .replace('{synth}', ct.synth ?? '')
      }
      const syn =
        mkTmpl('synthHeart', love) +
        '\n\n' +
        mkTmpl('synthVegetal', vegetal) +
        '\n\n' +
        mkTmpl('synthElements', elements) +
        '\n\n' +
        mkTmpl('synthLife', life)
      setSynthesis(syn)
      setDrawState(STATE.REVEALED)
      const cardsData = cur.map((c) => {
        const ct = getCardTranslated(c ?? undefined, locale) || c
        return {
          name: ct?.name ?? '',
          desc: ct?.desc,
          img: c?.img,
          synth: ct?.synth,
        }
      })
      onReadingComplete?.({
        type: 'four',
        cards: cardsData,
        synthesis: syn,
        intention: intention.trim() || '',
        reflection: '',
      })
    }
  }

  useEffect(() => {
    if (
      drawState !== STATE.REVEALED ||
      drawnCards.some((c) => !c) ||
      !user?.id ||
      interpretLoading ||
      interpretation
    )
      return
    setInterpretLoading(true)
    const cardsData = drawnCards.map((c) => {
      const ct = getCardTranslated(c ?? undefined, locale) || c
      return {
        name: ct?.name ?? '',
        desc: ct?.desc,
        synth: ct?.synth,
      }
    })
    tarotReadingsApi
      .interpret({
        type: 'four',
        intention: intention.trim() || undefined,
        cards: cardsData,
      })
      .then((res: unknown) => {
        const r = res as { interpretation?: string }
        if (r?.interpretation) setInterpretation(r.interpretation)
      })
      .catch(() => {})
      .finally(() => setInterpretLoading(false))
  }, [drawState, drawnCards, user?.id, intention, locale])

  useEffect(() => {
    if (interpretation && currentReadingId && onSaveReflection) {
      onSaveReflection(currentReadingId, { interpretation })
    }
  }, [interpretation, currentReadingId, onSaveReflection])

  function reset() {
    setIntention('')
    setFrozenIntention('')
    setDrawnCards([null, null, null, null])
    setRevealedDoors([])
    setSynthesis('')
    setInterpretation('')
    setInterpretLoading(false)
    setDrawState(STATE.IDLE)
  }

  return (
    <div className="space-y-5">
      <p className="text-center text-sm text-slate-400">
        {drawState === STATE.IDLE && t('tarot.cyclesDesc')}
        {drawState === STATE.OPENING && t('tarot.clickReveal')}
        {drawState === STATE.REVEALED && t('tarot.fourDoorsOpen')}
      </p>

      {drawState === STATE.IDLE && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            {t('tarot.intentionLabel')}
          </p>
          <VoiceTextInput
            value={intention}
            onChange={setIntention}
            placeholder={t('tarot.intentionPlaceholder')}
            rows={2}
          />
          <p className="text-[10px] text-slate-400 italic">
            {t('tarot.intentionOptional')}
          </p>
        </div>
      )}

      {drawState !== STATE.IDLE && (
        <div
          className="rounded-xl border border-violet-200/80 dark:border-violet-800/60 bg-violet-50/50 dark:bg-violet-950/25 px-4 py-3"
          aria-readonly="true"
        >
          <p className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-widest mb-1">
            {t('tarot.intentionLabel')}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-200 italic whitespace-pre-wrap">
            {frozenIntention ? `« ${frozenIntention} »` : '—'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FOUR_DOORS.map((door: DoorType, i: number) => {
          const isRevealed = revealedDoors.includes(i) || drawState === STATE.REVEALED
          const cardToShow = isRevealed ? drawnCards[i] : null
          const doorT = getDoorTranslated(door, locale) || door
          return (
            <div
              key={door.key}
              className={`rounded-2xl border-2 transition-all duration-500 overflow-hidden
                ${isRevealed ? door.border : 'border-slate-200 dark:border-slate-700'}
                ${!quotaExceeded && (drawState === STATE.IDLE || (drawState === STATE.OPENING && !isRevealed)) ? 'cursor-pointer hover:border-violet-300 dark:hover:border-violet-600' : ''}`}
              style={{
                background: isRevealed
                  ? `linear-gradient(135deg, ${door.bgFrom ?? 'rgba(254,242,242,1)'} 0%, ${door.bgTo ?? door.bgFrom ?? 'rgba(255,255,255,1)'} 100%)`
                  : undefined,
                boxShadow: isRevealed
                  ? `0 4px 24px ${door.shadowColor ?? 'rgba(0,0,0,0.1)'}`
                  : undefined,
                transition:
                  'transform 0.4s cubic-bezier(.23,1.12,.32,1), box-shadow 0.4s ease',
              }}
              onClick={
                quotaExceeded
                  ? undefined
                  : drawState === STATE.IDLE
                    ? () => startAndReveal(i)
                    : drawState === STATE.OPENING && !isRevealed
                      ? () => revealDoor(i)
                      : undefined
              }
            >
              <div
                className={`px-3 pt-3 pb-1 text-center ${isRevealed ? '' : 'dark:bg-slate-900'}`}
              >
                <p className={`text-xs font-bold ${door.color}`}>
                  {doorT.subtitle}
                </p>
                <p
                  className={`text-[10px] ${isRevealed ? 'text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  {doorT.title}
                </p>
              </div>

              <div className="flex justify-center py-2 px-2">
                <FlipCard
                  card={cardToShow}
                  spinning={false}
                  spinName=""
                  size="sm"
                  revealDelay={isRevealed ? 2000 : 0}
                  glowColor={door.glowColor ?? '#a78bfa'}
                />
              </div>

              {isRevealed && drawnCards[i] && (
                <div className="px-3 pb-3 relative min-h-[3rem]">
                  <p
                    className="text-sm text-slate-400 italic text-center absolute inset-x-3 bottom-3"
                    style={{ animation: 'reveal-hint-out 3.8s ease forwards' }}
                  >
                    {t('tarot.cardRevealing')}
                  </p>
                  <div
                    className="space-y-1"
                    style={{ animation: 'content-rise 0.5s ease 3.5s both' }}
                  >
                    <p className="text-xs text-slate-800 italic leading-snug">
                      {getCardTranslated(drawnCards[i] ?? undefined, locale)
                        ?.desc ?? drawnCards[i]?.desc}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {drawState === STATE.REVEALED && (
        <div className="flex justify-center">
          <button
            onClick={quotaExceeded ? undefined : reset}
            disabled={quotaExceeded}
            className={`relative px-10 py-3.5 rounded-full font-bold text-sm shadow-lg transition-all overflow-hidden bg-gradient-to-r from-violet-500 to-accent text-white
              ${quotaExceeded ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
            style={{ boxShadow: '0 4px 20px rgba(139,92,246,0.35)' }}
          >
            <span className="relative z-10">{t('tarot.newReading')}</span>
          </button>
        </div>
      )}

      {synthesis && (
        <div
          className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 via-white to-rose-50 dark:from-violet-950/20 dark:via-slate-900 dark:to-rose-950/10 p-5"
          style={{
            animation: 'content-rise 0.8s cubic-bezier(.23,1.12,.32,1) 3.5s both',
          }}
        >
          <p className="text-xs font-bold text-violet-500 mb-3 uppercase tracking-widest">
            {interpretation
              ? t('tarot.interpretationTitle')
              : t('tarot.synthesisPhrase')}
          </p>
          {interpretLoading && (
            <p className="text-sm text-slate-500 dark:text-slate-400 italic">
              {t('tarot.interpretationLoading')}
            </p>
          )}
          {!interpretLoading && interpretation && (
            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
              {interpretation}
            </p>
          )}
          {!interpretLoading && !interpretation && (
            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
              {synthesis}
            </p>
          )}
        </div>
      )}

      {synthesis && currentReadingId && (
        <div
          className="flex justify-center"
          style={{ animation: 'content-rise 0.6s ease 3.5s both' }}
        >
          <ShareTirageButton
            reading={{
              id: currentReadingId,
              type: 'four',
              cards: drawnCards.filter((c): c is CardType => Boolean(c)).map((c) => {
                const ct = getCardTranslated(c, locale) || c
                return { name: ct.name ?? '', synth: ct.synth }
              }),
              synthesis,
              intention: frozenIntention,
              createdAt: new Date().toISOString(),
            }}
            showLabel
          />
        </div>
      )}

      {synthesis && (
        <div style={{ animation: 'content-rise 0.6s ease 3.5s both' }}>
          <FourDoorsReflection
            readingId={currentReadingId}
            onSaveReflection={onSaveReflection}
          />
        </div>
      )}
    </div>
  )
}

function SimpleReflection({
  readingId,
  onSaveReflection,
}: {
  readingId: string | null
  onSaveReflection?: (id: string, updates: Record<string, unknown>) => void
}) {
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)

  function save() {
    if (!text.trim()) return
    if (readingId && onSaveReflection) onSaveReflection(readingId, { reflection: text })
    setSaved(true)
  }

  if (saved)
    return (
      <div
        className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 text-center relative z-[1]"
        style={{ animation: 'content-rise 0.4s ease' }}
      >
        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
          {t('tarot.reflectionSaved')}
        </p>
        <button
          onClick={() => setSaved(false)}
          className="mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          {t('common.modify')}
        </button>
      </div>
    )

  return (
    <div
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2 relative z-[1]"
      style={{ animation: 'content-rise 0.6s ease' }}
    >
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
        {t('tarot.reflectionLabel')}
      </p>
      <p className="text-xs text-slate-400">{t('tarot.reflectionQuestion')}</p>
      <VoiceTextInput
        value={text}
        onChange={setText}
        onSubmit={save}
        placeholder={t('tarot.reflectionPlaceholder')}
        rows={3}
        submitLabel={t('tarot.noteReflection')}
      />
    </div>
  )
}

function FourDoorsReflection({
  readingId,
  onSaveReflection,
}: {
  readingId: string | null
  onSaveReflection?: (id: string, updates: Record<string, unknown>) => void
}) {
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)

  function save() {
    if (!text.trim()) return
    if (readingId && onSaveReflection) onSaveReflection(readingId, { reflection: text })
    setSaved(true)
  }

  if (saved)
    return (
      <div
        className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 text-center"
        style={{ animation: 'content-rise 0.4s ease' }}
      >
        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
          {t('tarot.reflectionSaved')}
        </p>
        <button
          onClick={() => setSaved(false)}
          className="mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          {t('common.modify')}
        </button>
      </div>
    )

  return (
    <div
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2"
      style={{ animation: 'content-rise 0.6s ease' }}
    >
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
        {t('tarot.fourReflectionLabel')}
      </p>
      <p className="text-xs text-slate-400">{t('tarot.fourReflectionDesc')}</p>
      <VoiceTextInput
        value={text}
        onChange={setText}
        onSubmit={save}
        placeholder={t('tarot.fourReflectionPlaceholder')}
        rows={3}
        submitLabel={t('tarot.noteReflection')}
      />
    </div>
  )
}

type ReadingType = {
  id?: string
  reflection?: string
  type?: string
  card?: CardType
  cards?: CardType[]
  intention?: string
  interpretation?: string
  synthesis?: string
  createdAt?: string
}

function ReadingDetailReflection({
  reading,
  onSave,
}: {
  reading: ReadingType | null
  onSave?: (text: string) => void
}) {
  const [text, setText] = useState(reading?.reflection ?? '')
  const [saved, setSaved] = useState(!!reading?.reflection)
  const prevId = useRef(reading?.id)

  useEffect(() => {
    if (reading?.id !== prevId.current) {
      prevId.current = reading?.id
      setText(reading?.reflection ?? '')
      setSaved(!!reading?.reflection)
    }
  }, [reading?.id, reading?.reflection])

  function save() {
    if (!onSave) return
    onSave(text)
    setSaved(true)
  }

  if (saved) {
    return (
      <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
          {t('tarot.yourComment')}
        </p>
        {text ? (
          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">
            {text}
          </p>
        ) : (
          <p className="text-sm text-slate-400 italic">{t('tarot.noComment')}</p>
        )}
        <button
          onClick={() => setSaved(false)}
          className="mt-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          {t('common.modify')}
        </button>
      </div>
    )
  }

  return (
    <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
        {reading?.reflection
          ? t('tarot.editComment')
          : t('tarot.addComment')}
      </p>
      <VoiceTextInput
        value={text}
        onChange={setText}
        onSubmit={save}
        placeholder={t('tarot.commentPlaceholder')}
        rows={3}
        submitLabel={t('common.save')}
      />
    </div>
  )
}

function ReadingsList({
  readings,
  readingsLoading,
  onDelete,
  onUpdate,
  initialOpenReadingId,
  onClearReadingQuery,
}: {
  readings: Record<string, unknown>[]
  readingsLoading?: boolean
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: Record<string, unknown>) => void
  initialOpenReadingId?: string | null
  onClearReadingQuery?: () => void
}) {
  const locale = useStore((s) => s.locale)
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    if (!initialOpenReadingId || readingsLoading) return
    const want = String(initialOpenReadingId)
    const found = readings.some((r) => String((r as { id?: unknown }).id) === want)
    if (found) setDetailId(want)
  }, [initialOpenReadingId, readings, readingsLoading])

  const closeDetail = () => {
    setDetailId(null)
    onClearReadingQuery?.()
  }
  const detail = readings.find(
    (r) => String((r as { id?: string }).id) === detailId
  ) as ReadingType | undefined

  function formatDate(iso: string | undefined) {
    try {
      const d = new Date(iso ?? '')
      return d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  function summary(r: Record<string, unknown>) {
    const card = r.card as CardType | undefined
    const cards = r.cards as CardType[] | undefined
    if (r.type === 'simple') return card?.name ?? '—'
    if (r.type === 'four' && cards?.length)
      return cards.map((c) => c.name).join(' · ')
    return '—'
  }

  if (!readings.length) {
    return (
      <div className="text-center py-12 px-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <p className="text-4xl mb-3">🎴</p>
        <p className="text-slate-600 dark:text-slate-300 font-medium">
          {t('tarot.noReadings')}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('tarot.noReadingsDesc')} {t('tarot.useTabs')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {readings.map((r, index) => (
        <div
          key={`reading-${index}-${(r as { id?: string | number }).id ?? ''}`}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex items-center justify-between gap-3"
        >
          <button
            onClick={() => setDetailId(String((r as { id?: string }).id))}
            className="flex-1 text-left min-w-0 flex items-center gap-3"
          >
            {r.type === 'simple' && (r.card as CardType)?.img && (
              <img
                src={(r.card as CardType).img}
                alt={(r.card as CardType).name}
                className="w-10 h-14 object-contain rounded border border-slate-200 dark:border-slate-600 flex-shrink-0"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            )}
            {r.type === 'four' && (r.cards as CardType[])?.length > 0 && (
              <div className="flex gap-0.5 flex-shrink-0">
                {(r.cards as CardType[])
                  .slice(0, 4)
                  .map(
                    (c, i) =>
                      c.img && (
                        <img
                          key={i}
                          src={c.img}
                          alt={c.name}
                          className="w-7 h-10 object-contain rounded border border-slate-200 dark:border-slate-600"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).style.display =
                              'none'
                          }}
                        />
                      )
                  )}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatDate(r.createdAt as string)} ·{' '}
                {r.type === 'simple' ? t('tarot.simple') : t('tarot.fourDoors')}
              </p>
              <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                {summary(r)}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <ShareTirageButton reading={r} showLabel />
            <button
              onClick={() =>
                window.confirm(t('tarot.deleteConfirm')) && onDelete(String((r as { id?: string }).id))
              }
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title={t('common.delete')}
              aria-label={t('tarot.deleteReading')}
            >
              🗑
            </button>
          </div>
        </div>
      ))}

      {detailId && detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={closeDetail}
        >
          <div
            className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-700 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <p className="text-xs text-slate-500">
                  {formatDate(detail.createdAt)} ·{' '}
                  {detail.type === 'simple'
                    ? t('tarot.simple')
                    : t('tarot.fourDoors')}
                </p>
                <div className="flex items-center gap-2">
                  <ShareTirageButton reading={detail} showLabel />
                  <button
                    onClick={closeDetail}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    aria-label="Fermer"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {detail.intention && (
                <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 p-3 mb-3">
                  <p className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-widest mb-1">
                    {t('tarot.intentionLabel')}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 italic">
                    « {detail.intention} »
                  </p>
                </div>
              )}
              {detail.type === 'simple' && detail.card && (
                <>
                  {detail.card.img && (
                    <div className="flex justify-center">
                      <img
                        src={detail.card.img}
                        alt={detail.card.name}
                        className="w-32 h-48 object-contain rounded-xl border border-slate-200 dark:border-slate-600 shadow-md"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-accent">
                    {detail.card.name}
                  </h3>
                  {detail.interpretation ? (
                    <>
                      <p className="text-xs font-bold text-violet-500 mb-1 uppercase tracking-widest">
                        {t('tarot.interpretationTitle')}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
                        {detail.interpretation}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
                      {getCardTranslated(detail.card, locale)?.desc ??
                        detail.card.desc}
                    </p>
                  )}
                </>
              )}
              {detail.type === 'four' && (
                <>
                  <div className="flex flex-wrap justify-center gap-3">
                    {detail.cards?.map((c, i) => (
                      <div key={i} className="flex flex-col items-center">
                        {c.img && (
                          <img
                            src={c.img}
                            alt={c.name}
                            className="w-20 h-28 object-contain rounded-lg border border-slate-200 dark:border-slate-600 shadow"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).style.display =
                                'none'
                            }}
                          />
                        )}
                        <span className="mt-1 px-2 py-0.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-xs font-medium text-violet-700 dark:text-violet-300 text-center max-w-[80px] truncate">
                          {c.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  {(detail.interpretation || detail.synthesis) && (
                    <>
                      <p className="text-xs font-bold text-violet-500 mb-1 uppercase tracking-widest">
                        {detail.interpretation
                          ? t('tarot.interpretationTitle')
                          : t('tarot.synthesisPhrase')}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
                        {detail.interpretation || detail.synthesis}
                      </p>
                    </>
                  )}
                </>
              )}
              <ReadingDetailReflection
                reading={detail}
                onSave={(text) =>
                  onUpdate?.(String(detail.id), { reflection: text })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BuyLink({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div
      className="text-center pt-1"
      style={{ animation: 'content-rise 0.5s ease' }}
    >
      <BuyTarotCTA />
    </div>
  )
}

const TABS = [
  { id: 'simple', labelKey: 'simple', icon: '🎴' },
  { id: 'four', labelKey: 'fourDoors', icon: '🌿' },
  { id: 'list', labelKey: 'myReadings', icon: '📜' },
]

export default function TarotPage() {
  const locale = useStore((s) => s.locale)
  const hasDoneFirstTirage = useStore((s) => s.hasDoneFirstTirage)
  const setHasDoneFirstTirage = useStore((s) => s.setHasDoneFirstTirage)
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname() || '/tirage'
  const [hash, setHash] = useState('')
  const readingOpenParam = searchParams?.get('reading')?.trim() || null

  const clearReadingQuery = useCallback(() => {
    const p = new URLSearchParams(searchParams?.toString() ?? '')
    if (!p.has('reading')) return
    p.delete('reading')
    const q = p.toString()
    router.replace(`${pathname}${q ? `?${q}` : ''}`, { scroll: false })
  }, [router, pathname, searchParams])

  // landing_card : carte pré-sélectionnée depuis la landing page (intent card_analysis)
  // petal : id pétale → intention suggérée + tirage libre parmi tout le jeu (pas de carte « amour » imposée)
  const landingCardName = searchParams?.get('landing_card') || null
  const petalKeyRaw = (searchParams?.get('petal') || '').toLowerCase().trim()
  const isPetalFlow =
    !!petalKeyRaw && (PETAL_ORDER as readonly string[]).includes(petalKeyRaw)
  const petalSuggestedIntention = isPetalFlow ? t(`tarot.petalIntent.${petalKeyRaw}`) : ''
  const resolvedLandingName = landingCardName || null
  const landingCardObj = resolvedLandingName
    ? (ALL_CARDS.find((c) => c.name === decodeURIComponent(resolvedLandingName)) ?? null)
    : null
  const landingCardTranslated = landingCardObj
    ? (getCardTranslated(landingCardObj, locale) ?? landingCardObj)
    : null
  useEffect(() => {
    setHash(typeof window !== 'undefined' ? window.location.hash : '')
    const h = () => setHash(window.location.hash)
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  const [tab, setTab] = useState<'simple' | 'four' | 'list'>(() =>
    searchParams?.get('tab') === 'list' ? 'list' : 'simple'
  )

  // Si une carte de landing est présente, forcer l'onglet simple
  useEffect(() => {
    if (resolvedLandingName || isPetalFlow) setTab('simple')
  }, [resolvedLandingName, isPetalFlow])
  const {
    readings,
    loading: readingsLoading,
    addReading,
    updateReading,
    deleteReading,
  } = useReadings()
  const [currentSimpleReadingId, setCurrentSimpleReadingId] = useState<
    string | null
  >(null)
  const [currentFourReadingId, setCurrentFourReadingId] = useState<
    string | null
  >(null)
  const [quotaError, setQuotaError] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams?.get('tab') === 'list' || hash === '#section-tirages')
      setTab('list')
  }, [searchParams, hash])

  useEffect(() => {
    if (readingOpenParam) setTab('list')
  }, [readingOpenParam])

  const SAP_PER_DRAW = 5
  useEffect(() => {
    if (!user?.id) return
    billingApi
      .getAccess()
      .then((data: unknown) => {
        const d = data as Record<string, unknown> | null
        if (!d) return
        if (d.free_access || d.has_subscription) return
        const used = (d.usage as Record<string, number>)?.tirages_count ?? 0
        const limit = (d.limits as Record<string, number>)?.tirages_per_month ?? 5
        const totalSap =
          ((d.token_balance as number) ?? 0) +
          ((d.eternal_sap as number) ?? 0)
        if (used >= limit && totalSap < SAP_PER_DRAW) {
          const missing = SAP_PER_DRAW - totalSap
          const msg =
            totalSap > 0
              ? t('tarot.quotaErrorSap')
                  .replace('{missing}', String(missing))
                  .replace('{s}', missing > 1 ? 's' : '')
              : t('tarot.quotaErrorFree').replace('{limit}', String(limit))
          setQuotaError(msg)
        }
      })
      .catch(() => {})
  }, [user?.id])

  const handleSimpleComplete = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        const id = (await addReading(data)) as string
        setCurrentSimpleReadingId(id)
        const wasFirst = !hasDoneFirstTirage
        setHasDoneFirstTirage(true)
        setQuotaError(null)
        toast(t('tarot.readingSaved'), 'success')
        if (wasFirst) {
          setTimeout(
            () => toast(t('onboarding.tirageDoneHint'), 'success'),
            600
          )
        }
      } catch (err: unknown) {
        const e = err as { status?: number; code?: string; detail?: string; message?: string }
        if (e?.status === 402 || e?.code === 'quota_exceeded') {
          setQuotaError(e.detail || e.message || null)
        }
      }
    },
    [addReading, setHasDoneFirstTirage, hasDoneFirstTirage]
  )

  const handleFourComplete = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        const id = (await addReading(data)) as string
        setCurrentFourReadingId(id)
        const wasFirst = !hasDoneFirstTirage
        setHasDoneFirstTirage(true)
        setQuotaError(null)
        toast(t('tarot.readingSaved'), 'success')
        if (wasFirst) {
          setTimeout(
            () => toast(t('onboarding.tirageDoneHint'), 'success'),
            600
          )
        }
      } catch (err: unknown) {
        const e = err as { status?: number; code?: string; detail?: string; message?: string }
        if (e?.status === 402 || e?.code === 'quota_exceeded') {
          setQuotaError(e.detail || e.message || null)
        }
      }
    },
    [addReading, setHasDoneFirstTirage, hasDoneFirstTirage]
  )

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 py-2 min-w-0">
      <Breadcrumbs />

      {/* Bannière : carte landing préchoisie */}
      {resolvedLandingName && (
        <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50 to-rose-50 dark:from-violet-950/30 dark:to-rose-950/20 p-4 flex items-start gap-3">
          <span className="text-2xl shrink-0">✨</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">
              {t('tarot.landingCardWelcome') || 'Bienvenue ! Votre carte vous attend.'}
            </p>
            <p className="text-xs text-violet-600/70 dark:text-violet-400/70 mt-0.5">
              {t('tarot.landingCardHint') || 'L\'analyse de l\'IA se chargera automatiquement. Vous pouvez explorer le reste de l\'application ensuite.'}
            </p>
          </div>
        </div>
      )}
      {/* Bannière : arrivée depuis un pétale de la fleur (tirage pas automatique) */}
      {isPetalFlow && !resolvedLandingName && (
        <div className="rounded-2xl border border-teal-200/80 dark:border-teal-800/60 bg-gradient-to-r from-teal-50/90 to-violet-50/80 dark:from-teal-950/25 dark:to-violet-950/20 p-4 flex items-start gap-3">
          <span className="text-2xl shrink-0">🌸</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-teal-800 dark:text-teal-200">
              {t('tarot.petalFlowWelcome')}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
              {t('tarot.petalFlowHint')}
            </p>
          </div>
        </div>
      )}

      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent">
          {t('tarot.title')}
        </h2>
        <p className="text-sm text-rose-500 dark:text-rose-400 italic">
          {t('tarot.subtitle')}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
          {t('tarot.introDesc')}
          <span className="block mt-1.5">
            <strong className="text-slate-600 dark:text-slate-300">
              {t('tarot.simple')}
            </strong>{' '}
            {t('tarot.oneCardDesc2')}
          </span>
          <span className="block mt-1.5">
            <strong className="text-slate-600 dark:text-slate-300">
              {t('tarot.fourDoors')}
            </strong>{' '}
            {t('tarot.fourDoorsDesc2')}
          </span>
        </p>
      </div>

      {!hasDoneFirstTirage && (tab === 'simple' || tab === 'four') && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 p-4">
          <p className="text-sm text-rose-700 dark:text-rose-300">
            💡 {t('onboarding.tirageIntro')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-2 min-w-0">
        {TABS.map((tabItem, i) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id as 'simple' | 'four' | 'list')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all shrink-0 min-w-0
              ${i === TABS.length - 1 ? 'col-span-2 sm:col-span-1' : ''}
              ${tab === tabItem.id
                ? 'bg-gradient-to-r from-violet-500 to-accent text-white shadow-lg shadow-violet-500/25'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
          >
            <span className="shrink-0">{tabItem.icon}</span>
            <span className="truncate">{t(`tarot.${tabItem.labelKey}`)}</span>
          </button>
        ))}
      </div>

      {quotaError && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-4 flex items-start gap-3">
          <span className="text-xl shrink-0">🔒</span>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
              {t('tarot.quotaReached')}
            </p>
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {quotaError}
            </p>
            <Link
              href="/account"
              className="inline-block mt-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-500 to-rose-500 px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              {t('tarot.activatePromo')}
            </Link>
          </div>
        </div>
      )}

      {tab === 'simple' && (
        <SimpleDraw
          onReadingComplete={handleSimpleComplete}
          currentReadingId={currentSimpleReadingId}
          onSaveReflection={updateReading}
          quotaExceeded={!!quotaError}
          landingCard={landingCardTranslated}
          initialIntention={
            isPetalFlow && !landingCardObj ? petalSuggestedIntention : undefined
          }
          petalFlow={isPetalFlow && !landingCardObj}
        />
      )}
      {tab === 'four' && (
        <FourDoorsDraw
          onReadingComplete={handleFourComplete}
          currentReadingId={currentFourReadingId}
          onSaveReflection={updateReading}
          quotaExceeded={!!quotaError}
        />
      )}
      {tab === 'list' && (
        <div id="section-tirages">
          <ReadingsList
            readings={readings}
            readingsLoading={readingsLoading}
            onDelete={deleteReading}
            onUpdate={updateReading}
            initialOpenReadingId={readingOpenParam}
            onClearReadingQuery={clearReadingQuery}
          />
        </div>
      )}

      <style>{`
        @keyframes card-float {
          0%, 100% { transform: translateY(0px) rotateZ(-0.5deg); }
          50% { transform: translateY(-10px) rotateZ(0.5deg); }
        }
        @keyframes card-flip-arc {
          0% { transform: rotateY(0deg) translateY(0); }
          15% { transform: rotateY(27deg) translateY(-6px); }
          35% { transform: rotateY(63deg) translateY(-20px); }
          55% { transform: rotateY(99deg) translateY(-26px); }
          75% { transform: rotateY(135deg) translateY(-14px); }
          90% { transform: rotateY(162deg) translateY(-4px); }
          100% { transform: rotateY(180deg) translateY(0); }
        }
        @keyframes card-land {
          0% { transform: rotateY(180deg) scale(1.08); }
          70% { transform: rotateY(180deg) scale(0.97); }
          100% { transform: rotateY(180deg) scale(1); }
        }
        @keyframes card-pre-reveal {
          0%, 100% { transform: translateY(0) rotateY(0deg) rotateZ(-0.5deg); }
          16.6% { transform: translateY(-5px) rotateY(4deg) rotateZ(0.4deg); }
          33.3% { transform: translateY(-4px) rotateY(-3deg) rotateZ(-0.3deg); }
          50% { transform: translateY(-7px) rotateY(3deg) rotateZ(0.35deg); }
          66.6% { transform: translateY(-3px) rotateY(-2deg) rotateZ(-0.25deg); }
          83.3% { transform: translateY(-6px) rotateY(2deg) rotateZ(0.3deg); }
        }
        @keyframes card-dance {
          0%, 100% { transform: rotateY(180deg) translateY(0) rotateZ(-0.6deg); }
          25% { transform: rotateY(180deg) translateY(-4px) rotateZ(0.6deg); }
          50% { transform: rotateY(180deg) translateY(-2px) rotateZ(-0.4deg); }
          75% { transform: rotateY(180deg) translateY(-5px) rotateZ(0.5deg); }
        }
        @keyframes particle-fly {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + cos(var(--angle)) * var(--dist)), calc(-50% + sin(var(--angle)) * var(--dist))) scale(0); opacity: 0; }
        }
        @keyframes ring-expand {
          0% { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes glow-pulse {
          0% { opacity: 0.4; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes bg-breathe {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes shimmer-sweep {
          0% { left: -100%; }
          100% { left: 150%; }
        }
        @keyframes content-rise {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes reveal-hint-out {
          0%, 92% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
