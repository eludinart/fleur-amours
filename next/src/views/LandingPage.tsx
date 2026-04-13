'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStore } from '@/store/useStore'
import { t, setLocale as syncI18nLocale, SUPPORTED_LOCALES } from '@/i18n'
import { BACK_IMG, getCardImageByName, getLandingCardEntries } from '@/data/tarotCards'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

/** Durée du flip 3D + marge avant nouveau tirage (ms) */
const FLIP_REDRAW_MS = 900
const flipTransition = { duration: 0.82, ease: [0.22, 1, 0.36, 1] as const }

// ─── Card data (locale) ───────────────────────────────────────────────────────

type CardRaw = { desc: string; synth: string }

type ParsedCard = {
  id: string
  name: string
  essence: string
  rootQuestion: string
  lumiere: string
}

function splitCardDesc(desc: string): { essenceLine: string; rootPart: string } {
  const markers = ['\nQuestion racine : ', '\nRoot question: ', '\nPregunta raíz: '] as const
  for (const m of markers) {
    const i = desc.indexOf(m)
    if (i !== -1) {
      return { essenceLine: desc.slice(0, i), rootPart: desc.slice(i + m.length) }
    }
  }
  return { essenceLine: desc, rootPart: '' }
}

function parseCard(name: string, data: CardRaw): ParsedCard {
  const { essenceLine, rootPart } = splitCardDesc(data.desc)
  const rt = rootPart.trim()
  const rootQuestion = rt ? rt.replace(/\?$/, '') + '?' : ''
  const essence = essenceLine.split(', ').slice(0, 2).join(', ')
  return {
    id: name,
    name,
    essence,
    rootQuestion,
    lumiere: data.synth,
  }
}

function pickRandomFromLocale(locale: string | undefined): ParsedCard {
  const entries = getLandingCardEntries(locale)
  const idx = Math.floor(Math.random() * entries.length)
  const [name, raw] = entries[idx]
  return parseCard(name, raw)
}

// ─── Background (maille douce, profondeur) ───────────────────────────────────

function LandingBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(165deg, #fff9f2 0%, #fdf3e8 42%, #faf0e8 72%, #f8f4ef 100%)',
        }}
      />
      <div className="absolute -top-32 right-[-10%] h-[22rem] w-[22rem] rounded-full bg-rose-200/45 blur-[80px] sm:h-[28rem] sm:w-[28rem]" />
      <div className="absolute top-[38%] -left-24 h-[20rem] w-[20rem] rounded-full bg-violet-200/35 blur-[72px]" />
      <div className="absolute bottom-[-15%] left-1/2 h-[14rem] w-[min(140%,48rem)] -translate-x-1/2 rounded-full bg-amber-100/50 blur-[48px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(251,207,232,0.25),transparent)]" />
    </div>
  )
}

// ─── Dos officiel ─────────────────────────────────────────────────────────────

function CardBack({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03, y: -6 }}
      whileTap={{ scale: 0.98 }}
      aria-label={t('landing.tapToReveal')}
      className="relative mx-auto aspect-[2/3] w-[13rem] cursor-pointer overflow-hidden rounded-[1.25rem] shadow-[0_20px_44px_-12px_rgba(91,33,182,0.32)] ring-1 ring-violet-950/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-4 focus-visible:ring-offset-[#fdf6ed] sm:w-[14.5rem]"
    >
      <img
        src={BACK_IMG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        draggable={false}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/[0.12] via-transparent to-transparent"
        aria-hidden
      />
    </motion.button>
  )
}

// ─── Face : grille image + texte (desktop), colonne (mobile) ─────────────────

function CardFace({ card }: { card: ParsedCard }) {
  const faceSrc = getCardImageByName(card.id)

  return (
    <div
      className="relative w-full max-w-lg overflow-hidden rounded-[1.25rem] shadow-[0_20px_48px_-14px_rgba(120,50,80,0.2)] ring-1 ring-amber-200/60 md:max-w-3xl"
      style={{
        background: 'linear-gradient(145deg, rgba(255,252,248,0.98) 0%, #f7efe6 55%, #f3e9dc 100%)',
      }}
    >
      <div className="absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r from-violet-400 via-rose-400 to-amber-400" />

      <div className="grid gap-3 p-4 sm:gap-4 sm:p-5 md:grid-cols-[minmax(0,9.5rem)_1fr] md:gap-5 md:items-start lg:grid-cols-[minmax(0,10.5rem)_1fr]">
        {faceSrc ? (
          <div className="flex justify-center md:justify-start">
            <img
              key={card.id}
              src={faceSrc}
              alt=""
              className="aspect-[2/3] w-[8.25rem] max-w-full rounded-lg border border-amber-200/60 bg-stone-100 object-cover shadow-md sm:w-[9.25rem] md:w-[10.25rem]"
              draggable={false}
              onError={(e) => {
                const el = e.currentTarget
                el.src = BACK_IMG
                el.className =
                  'aspect-[2/3] w-[8.25rem] max-w-full rounded-lg border border-amber-200/60 bg-stone-100 object-cover shadow-md opacity-85 sm:w-[9.25rem] md:w-[10.25rem]'
              }}
            />
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col gap-2.5 text-center md:text-left">
          <div>
            <p className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-amber-700/85 sm:text-xs">
              {t('landing.cardLabel')}
            </p>
            <h3 className="mt-1 break-words font-serif text-lg font-semibold leading-snug text-stone-900 sm:text-xl md:text-2xl lg:text-3xl">
              {card.name}
            </h3>
            <div className="mx-auto mt-2 h-px w-12 bg-gradient-to-r from-transparent via-rose-400 to-transparent md:mx-0" />
          </div>

          <div className="space-y-2">
            <div className="rounded-lg border border-rose-100/80 bg-white/75 p-3 shadow-sm backdrop-blur-sm sm:p-3.5">
              <span className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-rose-500 sm:text-xs">
                {t('landing.essence')}
              </span>
              <p className="mt-1 font-serif text-sm leading-snug text-stone-700 sm:text-base line-clamp-2 sm:line-clamp-3 md:line-clamp-4">
                {card.essence}
              </p>
            </div>
            <div className="rounded-lg border border-violet-100/90 bg-violet-50/65 p-3 shadow-sm sm:p-3.5">
              <span className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-violet-600 sm:text-xs">
                {t('landing.rootQuestion')}
              </span>
              <p className="mt-1 font-serif text-sm italic leading-snug text-stone-700 sm:text-base line-clamp-2 sm:line-clamp-3 md:line-clamp-4">
                {card.rootQuestion}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400 via-rose-400 to-violet-500" />
    </div>
  )
}

// ─── Flip 3D : dos ↔ face ────────────────────────────────────────────────────

function CardFlipRitual({
  revealed,
  card,
  mounted,
  onBackClick,
}: {
  revealed: boolean
  card: ParsedCard | null
  mounted: boolean
  onBackClick: () => void
}) {
  return (
    <div className="mx-auto w-full max-w-3xl [perspective:1680px]">
      <div className="relative min-h-[26rem] w-full sm:min-h-[28rem] md:min-h-[30rem]">
        <motion.div
          className="absolute inset-0 w-full [transform-style:preserve-3d]"
          initial={false}
          animate={{ rotateY: revealed ? 180 : 0 }}
          transition={flipTransition}
          style={{
            transformStyle: 'preserve-3d',
            WebkitTransformStyle: 'preserve-3d',
            transformOrigin: 'center center',
          }}
        >
          {/* Face arrière (dos de carte) */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-start pt-1"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(0deg) translateZ(3px)',
            }}
          >
            {mounted ? (
              <CardBack onClick={onBackClick} />
            ) : (
              <div className="mx-auto aspect-[2/3] w-[13rem] animate-pulse rounded-[1.25rem] bg-stone-200/60 sm:w-[14.5rem]" />
            )}
            <p className="mt-3 text-center font-serif text-sm text-stone-600 sm:text-base">
              {t('landing.tapToReveal')}
            </p>
          </div>

          {/* Face avant (résultat) */}
          <div
            className="scrollbar-cream absolute inset-0 flex items-start justify-center overflow-x-hidden overflow-y-auto px-0 pt-1 sm:px-1"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg) translateZ(3px)',
            }}
          >
            {card ? (
              <motion.div
                key={card.id}
                initial={{ opacity: 0.85, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="w-full"
              >
                <CardFace card={card} />
              </motion.div>
            ) : (
              <div className="min-h-[16rem] w-full rounded-2xl bg-stone-100/40" />
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LandingPage() {
  const locale = useStore((s) => s.locale)
  const setStoreLocale = useStore((s) => s.setLocale)
  const router = useRouter()

  const [card, setCard] = useState<ParsedCard | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!revealed || !card?.id) return
    const map = Object.fromEntries(getLandingCardEntries(locale))
    const raw = map[card.id]
    if (raw) setCard(parseCard(card.id, raw))
  }, [locale, revealed, card?.id])

  const drawCard = useCallback(() => {
    setCard(pickRandomFromLocale(locale))
    setRevealed(true)
  }, [locale])

  const redraw = useCallback(() => {
    setRevealed(false)
    setTimeout(() => {
      setCard(pickRandomFromLocale(locale))
      setRevealed(true)
    }, FLIP_REDRAW_MS)
  }, [locale])

  const goRegister = useCallback(
    (cardId?: string) => {
      const params = new URLSearchParams({ mode: 'register', intent: 'card_analysis' })
      if (cardId) params.set('cardId', encodeURIComponent(cardId))
      router.push(`${basePath}/login?${params.toString()}`)
    },
    [router]
  )

  const goLogin = useCallback(() => router.push(`${basePath}/login`), [router])
  const goRegisterPlain = useCallback(() => router.push(`${basePath}/login?mode=register`), [router])

  if (typeof window !== 'undefined') {
    syncI18nLocale(locale || 'fr')
  }

  const primaryBtn =
    'inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-600 via-violet-500 to-rose-500 px-8 py-3.5 text-base font-semibold tracking-wide text-white shadow-[0_10px_28px_-8px_rgba(225,29,72,0.42)] transition hover:shadow-[0_14px_36px_-8px_rgba(225,29,72,0.48)] sm:px-9 sm:py-4'

  const secondaryBtn =
    'inline-flex items-center justify-center rounded-full border-2 border-stone-300/90 bg-white/90 px-7 py-3 text-base font-semibold tracking-wide text-stone-800 shadow-sm transition hover:border-violet-400/80 hover:bg-white hover:text-violet-900 sm:px-8 sm:py-3.5'

  const benefitItems = [
    {
      icon: '🧭',
      titleKey: 'landing.benefitClarityTitle',
      descKey: 'landing.benefitClarityDesc',
      tint: 'from-rose-50/90 to-white border-rose-100/80',
    },
    {
      icon: '🔮',
      titleKey: 'landing.benefitReadingsTitle',
      descKey: 'landing.benefitReadingsDesc',
      tint: 'from-violet-50/90 to-white border-violet-100/80',
    },
    {
      icon: '✨',
      titleKey: 'landing.benefitMirrorTitle',
      descKey: 'landing.benefitMirrorDesc',
      tint: 'from-amber-50/80 to-white border-amber-100/80',
    },
    {
      icon: '🌿',
      titleKey: 'landing.benefitJourneyTitle',
      descKey: 'landing.benefitJourneyDesc',
      tint: 'from-emerald-50/70 to-white border-emerald-100/70',
    },
    {
      icon: '🌸',
      titleKey: 'landing.benefitSpaceTitle',
      descKey: 'landing.benefitSpaceDesc',
      tint: 'from-pink-50/80 to-white border-pink-100/70',
    },
    {
      icon: '💬',
      titleKey: 'landing.benefitHumanTitle',
      descKey: 'landing.benefitHumanDesc',
      tint: 'from-sky-50/80 to-white border-sky-100/70',
    },
  ] as const

  const socialProofItems = [
    { quoteKey: 'landing.socialQuote1', authorKey: 'landing.socialQuote1Author', tint: 'from-rose-50/95 to-white border-rose-100/90' },
    { quoteKey: 'landing.socialQuote2', authorKey: 'landing.socialQuote2Author', tint: 'from-violet-50/95 to-white border-violet-100/90' },
    { quoteKey: 'landing.socialQuote3', authorKey: 'landing.socialQuote3Author', tint: 'from-amber-50/90 to-white border-amber-100/85' },
  ] as const

  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <LandingBackdrop />

      <header
        className="sticky top-0 z-20 border-b border-amber-200/40 bg-[rgba(255,249,242,0.82)] py-2.5 backdrop-blur-md sm:py-3"
        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset' }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-rose-500 shadow-md shadow-rose-400/25 ring-2 ring-white/80 sm:h-11 sm:w-11">
              <img
                src={`${basePath}/juste-la-fleur.png`}
                alt=""
                className="h-full w-full object-contain p-1"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate font-serif text-lg font-semibold tracking-wide text-stone-900 sm:text-xl">
                Fleur d&apos;AmOurs
              </p>
              <p className="hidden font-sans text-xs uppercase tracking-[0.16em] text-stone-500 sm:block">
                {t('landing.tagline')}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <div
              className="mr-1 hidden items-center gap-0.5 rounded-full border border-stone-200/80 bg-white/70 p-0.5 sm:flex"
              role="group"
              aria-label="Langue"
            >
              {SUPPORTED_LOCALES.map(({ code }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setStoreLocale(code)}
                  className={`rounded-full px-3 py-1.5 font-sans text-xs font-bold uppercase tracking-wider transition-colors sm:text-sm ${
                    (locale || 'fr') === code
                      ? 'bg-stone-800 text-white shadow-sm'
                      : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={goLogin}
              className="rounded-full px-4 py-2.5 font-sans text-base font-medium text-stone-600 transition hover:bg-white/80 hover:text-stone-900"
            >
              {t('landing.ctaLogin')}
            </button>
            <button
              type="button"
              onClick={goRegisterPlain}
              title={t('landing.registerButtonTitle')}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-600 via-violet-500 to-rose-500 px-5 py-2.5 text-base font-semibold tracking-wide text-white shadow-[0_10px_28px_-8px_rgba(225,29,72,0.42)] transition hover:shadow-[0_14px_36px_-8px_rgba(225,29,72,0.48)] sm:px-6 sm:py-3 sm:text-lg"
            >
              {t('landing.ctaRegister')}
            </button>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-5 sm:px-6 sm:pb-10 sm:pt-7">
          <div className="grid gap-6 lg:grid-cols-12 lg:gap-10 lg:items-start">
            {/* Colonne message */}
            <div className="text-center lg:col-span-5 lg:pt-4 lg:text-left">
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.1 } },
                }}
              >
                <motion.span
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0 },
                  }}
                  className="inline-flex items-center rounded-full border border-rose-200/90 bg-white/70 px-5 py-2.5 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-rose-600 shadow-sm backdrop-blur-sm sm:px-6 sm:py-3 sm:text-sm"
                >
                  {t('landing.tagline')}
                </motion.span>
                <motion.h1
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    show: { opacity: 1, y: 0 },
                  }}
                  className="mt-6 font-serif text-[2.125rem] font-semibold leading-[1.12] tracking-tight text-stone-900 sm:text-4xl sm:leading-[1.1] md:text-5xl lg:text-[2.75rem] lg:leading-[1.08]"
                >
                  {t('landing.heroTitle')}
                </motion.h1>
                <motion.p
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    show: { opacity: 1, y: 0 },
                  }}
                  className="mx-auto mt-5 max-w-lg font-serif text-lg italic leading-relaxed text-stone-600 sm:text-xl lg:mx-0 lg:max-w-xl lg:text-2xl"
                >
                  {t('landing.heroSubtitle')}
                </motion.p>
                <motion.p
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: { opacity: 1, y: 0 },
                  }}
                  className="mx-auto mt-5 max-w-lg text-center font-sans text-[0.95rem] font-medium leading-relaxed text-stone-700 sm:text-base lg:mx-0 lg:max-w-xl lg:text-left"
                >
                  {t('landing.heroAccountHook')}
                </motion.p>
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0 },
                  }}
                  className="mx-auto mt-6 flex w-full max-w-lg flex-col gap-3 sm:flex-row sm:justify-center lg:mx-0 lg:max-w-xl lg:justify-start"
                >
                  <button type="button" onClick={goRegisterPlain} className={`${secondaryBtn} w-full sm:w-auto`}>
                    {t('landing.ctaOpenGarden')}
                  </button>
                </motion.div>
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0 },
                  }}
                  className="mx-auto mt-6 max-w-lg rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/90 to-white/80 p-5 text-center shadow-sm backdrop-blur-sm sm:p-6 lg:mx-0 lg:max-w-xl lg:text-left"
                >
                  <p className="font-sans text-sm font-semibold text-violet-900 sm:text-base">{t('landing.accountVsTitle')}</p>
                  <p className="mt-2 font-sans text-sm leading-relaxed text-stone-600 sm:text-[0.95rem]">
                    {t('landing.accountVsBody')}
                  </p>
                </motion.div>
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0 },
                  }}
                  className="mx-auto mt-6 max-w-lg rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-white/90 p-5 text-center shadow-sm backdrop-blur-sm sm:p-6 lg:mx-0 lg:max-w-xl lg:text-left"
                >
                  <span className="inline-flex rounded-full border border-teal-200/90 bg-white/80 px-3 py-1 font-sans text-[0.65rem] font-bold uppercase tracking-[0.18em] text-teal-800 sm:text-xs">
                    {t('landing.proTeaserBadge')}
                  </span>
                  <p className="mt-3 font-sans text-base font-semibold text-stone-900 sm:text-lg">{t('landing.proTeaserTitle')}</p>
                  <p className="mt-2 font-sans text-sm leading-relaxed text-stone-600 sm:text-[0.95rem]">{t('landing.proTeaserLead')}</p>
                  <ul className="mt-4 space-y-2 text-left font-sans text-sm text-stone-600 sm:text-[0.95rem]">
                    <li className="flex gap-2">
                      <span className="text-teal-600" aria-hidden>
                        ✓
                      </span>
                      <span>{t('landing.proTeaserBulletA')}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-teal-600" aria-hidden>
                        ✓
                      </span>
                      <span>{t('landing.proTeaserBulletB')}</span>
                    </li>
                  </ul>
                  <Link
                    href="/accompagnants"
                    className="mt-5 inline-flex items-center font-sans text-sm font-semibold text-teal-800 underline decoration-teal-300 decoration-2 underline-offset-4 transition hover:text-teal-950"
                  >
                    {t('landing.proTeaserCta')} →
                  </Link>
                </motion.div>
                <motion.div
                  variants={{
                    hidden: { opacity: 0 },
                    show: { opacity: 1 },
                  }}
                  className="mt-6 flex justify-center gap-1 sm:hidden"
                  role="group"
                  aria-label="Langue"
                >
                  {SUPPORTED_LOCALES.map(({ code }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setStoreLocale(code)}
                      className={`rounded-full px-3 py-2 font-sans text-xs font-bold uppercase tracking-wider sm:text-sm ${
                        (locale || 'fr') === code
                          ? 'bg-stone-800 text-white'
                          : 'border border-stone-200 bg-white/80 text-stone-500'
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </motion.div>
                <motion.div
                  variants={{
                    hidden: { opacity: 0 },
                    show: { opacity: 1 },
                  }}
                  className="mx-auto mt-8 hidden h-px w-24 bg-gradient-to-r from-transparent via-rose-300/80 to-transparent lg:mx-0 lg:block"
                />
              </motion.div>
            </div>

            {/* Colonne rituel */}
            <div className="flex flex-col items-center lg:col-span-7 lg:items-stretch">
              <p className="mb-5 font-sans text-sm font-semibold uppercase tracking-[0.28em] text-stone-500 sm:text-base">
                {t('landing.ritualSection')}
              </p>

              <div className="w-full max-w-lg lg:max-w-none">
                <div className="rounded-[1.75rem] border border-white/80 bg-gradient-to-b from-white/50 to-amber-50/25 p-6 shadow-[0_24px_60px_-20px_rgba(120,60,80,0.18)] backdrop-blur-md sm:p-10">
                  <div className="flex flex-col items-center gap-6 sm:gap-7">
                    <CardFlipRitual
                      revealed={revealed}
                      card={card}
                      mounted={mounted}
                      onBackClick={drawCard}
                    />

                    <div className="flex w-full flex-col items-stretch gap-3 sm:mx-auto sm:max-w-lg">
                      {!revealed ? (
                        <motion.button
                          type="button"
                          onClick={drawCard}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={primaryBtn + ' w-full'}
                        >
                          <span className="mr-2 opacity-90">✦</span>
                          {t('landing.ctaDraw')}
                        </motion.button>
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                          <button
                            type="button"
                            onClick={redraw}
                            className="rounded-full border border-stone-200/90 bg-white/80 px-6 py-3 font-sans text-base font-medium text-stone-600 shadow-sm transition hover:border-stone-300 hover:bg-white sm:text-lg"
                          >
                            ↺ {t('landing.redraw')}
                          </button>
                          <button
                            type="button"
                            onClick={() => goRegister(card?.id)}
                            className={`${primaryBtn} w-full sm:w-auto`}
                          >
                            {t('landing.fullAnalysis')} →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.45 }}
                className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-sans text-xs text-stone-400 sm:text-sm lg:justify-start"
              >
                <span className="inline-flex items-center gap-1.5" aria-hidden>
                  <svg className="h-3.5 w-3.5 shrink-0 text-emerald-600/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <span>{t('landing.trustLine')}</span>
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mt-8 w-full max-w-lg lg:max-w-none"
                aria-label={t('landing.visualTeaserAria')}
              >
                <div className="overflow-hidden rounded-[1.35rem] border border-violet-200/60 bg-gradient-to-br from-white/90 via-violet-50/40 to-rose-50/50 shadow-[0_20px_50px_-24px_rgba(91,33,182,0.28)] backdrop-blur-sm">
                  <div className="grid items-stretch gap-0 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
                    <div className="relative bg-slate-950 p-3 sm:p-4 md:p-5">
                      <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-900 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)] ring-1 ring-white/5">
                        <div className="flex items-center gap-1.5 border-b border-white/10 bg-slate-900/95 px-3 py-2">
                          <span className="h-2 w-2 rounded-full bg-rose-400/80" />
                          <span className="h-2 w-2 rounded-full bg-amber-300/80" />
                          <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
                          <span className="ml-2 flex-1 truncate rounded-md bg-slate-800/90 px-2 py-0.5 text-center font-sans text-[0.6rem] font-medium tracking-wide text-slate-400">
                            Fleur d&apos;AmOurs · jardin
                          </span>
                        </div>
                        <div className="relative bg-slate-950">
                          <img
                            src={`${basePath}/landing-fleur-app-preview.png`}
                            alt={t('landing.visualTeaserAlt')}
                            width={1200}
                            height={750}
                            className="mx-auto h-auto w-full max-h-[min(52vh,22rem)] object-contain object-left sm:max-h-[min(58vh,26rem)] md:max-h-[min(72vh,32rem)] lg:max-h-[min(78vh,36rem)]"
                            draggable={false}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              const el = e.currentTarget
                              el.src = `${basePath}/juste-la-fleur.png`
                              el.alt = ''
                              el.className = 'mx-auto h-40 w-auto object-contain p-8 opacity-90 sm:h-48'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col justify-center border-t border-violet-100/80 p-6 sm:p-8 md:border-l md:border-t-0">
                      <p className="font-sans text-[0.65rem] font-bold uppercase tracking-[0.2em] text-violet-600/90">✦ Jardin</p>
                      <h3 className="mt-2 font-serif text-xl font-semibold leading-snug text-stone-900 sm:text-2xl">
                        {t('landing.visualTeaserTitle')}
                      </h3>
                      <p className="mt-3 font-sans text-sm leading-relaxed text-stone-600 sm:text-[0.95rem]">
                        {t('landing.visualTeaserBody')}
                      </p>
                      <button
                        type="button"
                        onClick={goRegisterPlain}
                        className={`${primaryBtn} mt-6 w-full sm:w-auto self-start`}
                      >
                        {t('landing.visualTeaserCta')}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          <section
            className="mt-14 border-t border-amber-200/50 pt-12 sm:mt-16 sm:pt-14"
            aria-labelledby="landing-benefits-heading"
          >
            <h2
              id="landing-benefits-heading"
              className="text-center font-serif text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl"
            >
              {t('landing.benefitsTitle')}
            </h2>
            <ul className="mt-8 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {benefitItems.map(({ icon, titleKey, descKey, tint }) => (
                <li
                  key={titleKey}
                  className={`flex flex-col gap-2 rounded-2xl border bg-gradient-to-br p-5 shadow-sm sm:p-6 ${tint}`}
                >
                  <span className="text-2xl sm:text-3xl" aria-hidden>
                    {icon}
                  </span>
                  <span className="font-sans text-base font-semibold text-stone-900 sm:text-lg">{t(titleKey)}</span>
                  <span className="font-sans text-sm leading-relaxed text-stone-600 sm:text-[0.95rem]">{t(descKey)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="mt-14 border-t border-amber-200/50 pt-12 sm:mt-16 sm:pt-14"
            aria-labelledby="landing-social-proof-heading"
          >
            <div className="mx-auto max-w-3xl text-center">
              <h2
                id="landing-social-proof-heading"
                className="font-serif text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl"
              >
                {t('landing.socialProofTitle')}
              </h2>
              <p className="mt-3 font-sans text-sm leading-relaxed text-stone-600 sm:text-base">
                {t('landing.socialProofIntro')}
              </p>
            </div>
            <ul className="mx-auto mt-8 grid max-w-6xl list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {socialProofItems.map(({ quoteKey, authorKey, tint }, i) => (
                <motion.li
                  key={quoteKey}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <figure
                    className={`flex h-full flex-col rounded-2xl border bg-gradient-to-br p-5 shadow-sm sm:p-6 ${tint}`}
                  >
                    <blockquote className="flex-1 font-serif text-base italic leading-snug text-stone-800 sm:text-lg">
                      {t(quoteKey)}
                    </blockquote>
                    <figcaption className="mt-4 border-t border-stone-200/80 pt-3 font-sans text-sm font-semibold text-stone-600">
                      — {t(authorKey)}
                    </figcaption>
                  </figure>
                </motion.li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <footer className="relative mt-auto border-t border-amber-200/50 bg-gradient-to-t from-amber-50/40 to-transparent py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center sm:flex-row sm:justify-between sm:text-left sm:px-6">
          <p className="max-w-lg font-serif text-sm leading-relaxed text-stone-500 sm:text-base">{t('landing.footerNote')}</p>
          <p className="font-sans text-base text-stone-600 sm:text-lg">
            {t('landing.alreadyGardener')}{' '}
            <button
              type="button"
              onClick={goLogin}
              className="font-semibold text-rose-600 underline decoration-rose-300 decoration-2 underline-offset-4 transition hover:text-rose-700"
            >
              {t('landing.signIn')}
            </button>
          </p>
        </div>
      </footer>
    </div>
  )
}
