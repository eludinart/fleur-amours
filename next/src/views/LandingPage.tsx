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

export function LandingPage({
  showAccessSection = true,
  showIndividualSection = false,
}: {
  showAccessSection?: boolean
  showIndividualSection?: boolean
}) {
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
  const accessBtnBase =
    'mt-6 inline-flex h-14 w-full items-center justify-center rounded-[999px] border px-5 font-sans text-sm font-semibold tracking-[0.01em] whitespace-nowrap shadow-[0_10px_24px_-14px_rgba(39,39,42,0.45)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-14px_rgba(39,39,42,0.42)] sm:px-6 sm:text-base'
  const accessBtnIndividual =
    'border-rose-200/70 bg-gradient-to-r from-rose-100 via-fuchsia-100 to-violet-100 text-rose-900 hover:border-rose-300'
  const accessBtnCoach =
    'border-violet-200/70 bg-gradient-to-r from-violet-100 via-indigo-100 to-sky-100 text-violet-900 hover:border-violet-300'
  const accessBtnCompany =
    'border-emerald-200/70 bg-gradient-to-r from-emerald-100 via-teal-100 to-lime-100 text-emerald-900 hover:border-emerald-300'

  const benefitItems = [
    { icon: '🧭', titleKey: 'landing.benefitClarityTitle', descKey: 'landing.benefitClarityDesc', tint: 'from-rose-50/90 to-white border-rose-100/80' },
    { icon: '🗂️', titleKey: 'landing.benefitReadingsTitle', descKey: 'landing.benefitReadingsDesc', tint: 'from-violet-50/90 to-white border-violet-100/80' },
    { icon: '✨', titleKey: 'landing.benefitMirrorTitle', descKey: 'landing.benefitMirrorDesc', tint: 'from-amber-50/80 to-white border-amber-100/80' },
    { icon: '🌿', titleKey: 'landing.benefitJourneyTitle', descKey: 'landing.benefitJourneyDesc', tint: 'from-emerald-50/70 to-white border-emerald-100/70' },
    { icon: '🤝', titleKey: 'landing.benefitHumanTitle', descKey: 'landing.benefitHumanDesc', tint: 'from-sky-50/80 to-white border-sky-100/70' },
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
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-5 sm:px-6 sm:pb-12 sm:pt-7">
          <div className="text-center">
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center rounded-full border border-rose-200/90 bg-white/70 px-5 py-2.5 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-rose-600 shadow-sm backdrop-blur-sm sm:px-6 sm:py-3 sm:text-sm"
            >
              {t('landing.tagline')}
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mt-6 max-w-4xl font-serif text-[2.125rem] font-semibold leading-[1.12] tracking-tight text-stone-900 sm:text-4xl sm:leading-[1.1] md:text-5xl"
            >
              {t('landing.heroTitle')}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mt-5 max-w-3xl font-sans text-base leading-relaxed text-stone-700 sm:text-lg"
            >
              {t('landing.heroSubtitle')}
            </motion.p>
          </div>

          {showAccessSection ? (
            <section className="mt-10" aria-labelledby="landing-access-heading">
              <h2 id="landing-access-heading" className="text-center font-serif text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
                {t('landing.accessTitle')}
              </h2>
              <p className="mx-auto mt-3 max-w-3xl text-center font-sans text-sm leading-relaxed text-stone-600 sm:text-base">
                {t('landing.accessSubtitle')}
              </p>

              <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
                <article className="flex h-full flex-col rounded-2xl border border-rose-100/80 bg-gradient-to-br from-rose-50/70 to-white p-6 shadow-sm">
                  <p className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-rose-700">{t('landing.accessIndividualBadge')}</p>
                  <h3 className="mt-2 font-serif text-2xl font-semibold text-stone-900">{t('landing.accessIndividualTitle')}</h3>
                  <p className="mt-3 font-sans text-sm leading-relaxed text-stone-600">{t('landing.accessIndividualBody')}</p>
                  <Link href="/particuliers" className={`${accessBtnBase} ${accessBtnIndividual} mt-auto`}>
                    {t('landing.accessIndividualCta')}
                  </Link>
                </article>

                <article className="flex h-full flex-col rounded-2xl border border-violet-100/85 bg-gradient-to-br from-violet-50/75 to-white p-6 shadow-sm">
                  <p className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-violet-700">{t('landing.accessCoachBadge')}</p>
                  <h3 className="mt-2 font-serif text-2xl font-semibold text-stone-900">{t('landing.accessCoachTitle')}</h3>
                  <p className="mt-3 font-sans text-sm leading-relaxed text-stone-600">{t('landing.accessCoachBody')}</p>
                  <Link href="/accompagnants" className={`${accessBtnBase} ${accessBtnCoach} mt-auto`}>
                    {t('landing.accessCoachCta')}
                  </Link>
                </article>

                <article className="flex h-full flex-col rounded-2xl border border-emerald-100/85 bg-gradient-to-br from-emerald-50/75 to-white p-6 shadow-sm">
                  <p className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-emerald-700">{t('landing.accessCompanyBadge')}</p>
                  <h3 className="mt-2 font-serif text-2xl font-semibold text-stone-900">{t('landing.accessCompanyTitle')}</h3>
                  <p className="mt-3 font-sans text-sm leading-relaxed text-stone-600">{t('landing.accessCompanyBody')}</p>
                  <Link href="/mycelium" className={`${accessBtnBase} ${accessBtnCompany} mt-auto`}>
                    {t('landing.accessCompanyCta')}
                  </Link>
                </article>
              </div>
            </section>
          ) : null}

          {showIndividualSection ? (
            <section className="mt-14 border-t border-amber-200/50 pt-12 sm:mt-16 sm:pt-14" aria-labelledby="landing-individual-heading">
            <h2 id="landing-individual-heading" className="text-center font-serif text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
              {t('landing.individualSectionTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-center font-sans text-sm leading-relaxed text-stone-600 sm:text-base">
              {t('landing.individualSectionLead')}
            </p>

            <div className="mx-auto mt-8 max-w-4xl rounded-[1.75rem] border border-white/80 bg-gradient-to-b from-white/50 to-amber-50/25 p-6 shadow-[0_24px_60px_-20px_rgba(120,60,80,0.18)] backdrop-blur-md sm:p-10">
              <div className="flex flex-col items-center gap-6 sm:gap-7">
                <CardFlipRitual
                  revealed={revealed}
                  card={card}
                  mounted={mounted}
                  onBackClick={drawCard}
                />
                <div className="flex w-full flex-col items-stretch gap-3 sm:mx-auto sm:max-w-lg">
                  {!revealed ? (
                    <motion.button type="button" onClick={drawCard} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={primaryBtn + ' w-full'}>
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
                      <button type="button" onClick={() => goRegister(card?.id)} className={`${primaryBtn} w-full sm:w-auto`}>
                        {t('landing.fullAnalysis')} →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-4 text-center font-sans text-xs text-stone-500 sm:text-sm">{t('landing.trustLine')}</p>
          </section>
          ) : null}

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
