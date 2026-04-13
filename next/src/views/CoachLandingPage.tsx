'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { t, setLocale as syncI18nLocale, SUPPORTED_LOCALES } from '@/i18n'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function CoachBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(165deg, #faf8ff 0%, #fdf3f8 38%, #fdf3e8 72%, #f8f4ef 100%)',
        }}
      />
      <div className="absolute -top-28 right-[-8%] h-[20rem] w-[20rem] rounded-full bg-violet-200/40 blur-[72px] sm:h-[26rem] sm:w-[26rem]" />
      <div className="absolute top-[32%] -left-20 h-[18rem] w-[18rem] rounded-full bg-rose-200/35 blur-[64px]" />
      <div className="absolute bottom-[-12%] left-1/2 h-[12rem] w-[min(120%,40rem)] -translate-x-1/2 rounded-full bg-amber-100/45 blur-[44px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_45%_at_50%_-15%,rgba(196,181,253,0.22),transparent)]" />
    </div>
  )
}

export function CoachLandingPage() {
  const locale = useStore((s) => s.locale)
  const setStoreLocale = useStore((s) => s.setLocale)
  const router = useRouter()

  if (typeof window !== 'undefined') {
    syncI18nLocale(locale || 'fr')
  }

  const goLogin = () => router.push(`${basePath}/login`)
  const goRegister = () => router.push(`${basePath}/login?mode=register`)

  const primaryBtn =
    'inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-600 via-violet-500 to-rose-500 px-7 py-3 text-base font-semibold tracking-wide text-white shadow-[0_10px_28px_-8px_rgba(91,33,182,0.35)] transition hover:shadow-[0_14px_36px_-8px_rgba(91,33,182,0.42)] sm:px-8 sm:py-3.5'
  const secondaryBtn =
    'inline-flex items-center justify-center rounded-full border-2 border-stone-300/90 bg-white/90 px-6 py-2.5 text-base font-semibold text-stone-800 shadow-sm transition hover:border-violet-400/80 hover:bg-white sm:px-7 sm:py-3'

  const pillars = [
    {
      icon: '🌿',
      titleKey: 'coachLanding.pillarToolTitle',
      descKey: 'coachLanding.pillarToolDesc',
      tint: 'from-emerald-50/90 to-white border-emerald-100/80',
    },
    {
      icon: '📋',
      titleKey: 'coachLanding.pillarPracticeTitle',
      descKey: 'coachLanding.pillarPracticeDesc',
      tint: 'from-violet-50/90 to-white border-violet-100/80',
    },
  ] as const

  const benefitRows = [
    { icon: '🌸', titleKey: 'coachLanding.b1Title', descKey: 'coachLanding.b1Desc' },
    { icon: '✦', titleKey: 'coachLanding.b2Title', descKey: 'coachLanding.b2Desc' },
    { icon: '📖', titleKey: 'coachLanding.b3Title', descKey: 'coachLanding.b3Desc' },
    { icon: '🌙', titleKey: 'coachLanding.b4Title', descKey: 'coachLanding.b4Desc' },
    { icon: '💬', titleKey: 'coachLanding.b5Title', descKey: 'coachLanding.b5Desc' },
    { icon: '🏡', titleKey: 'coachLanding.b6Title', descKey: 'coachLanding.b6Desc' },
  ] as const

  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <CoachBackdrop />

      <header
        className="sticky top-0 z-20 border-b border-violet-200/35 bg-[rgba(252,250,255,0.88)] py-2.5 backdrop-blur-md sm:py-3"
        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.65) inset' }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
            <Link href="/" className="flex min-w-0 items-center gap-3 rounded-xl pr-1 transition hover:opacity-90">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-rose-500 shadow-md shadow-rose-400/20 ring-2 ring-white/80 sm:h-11 sm:w-11">
                <img
                  src={`${basePath}/juste-la-fleur.png`}
                  alt=""
                  className="h-full w-full object-contain p-1"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate font-serif text-lg font-semibold tracking-wide text-stone-900 sm:text-xl">
                  Fleur d&apos;AmOurs
                </p>
                <p className="hidden font-sans text-xs uppercase tracking-[0.16em] text-violet-700/80 sm:block">
                  {t('coachLanding.tagline')}
                </p>
              </div>
            </Link>
            <Link
              href="/"
              className="font-sans text-sm font-medium text-violet-700 underline decoration-violet-300 decoration-2 underline-offset-4 hover:text-violet-900"
            >
              {t('coachLanding.navHome')}
            </Link>
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
              className="rounded-full px-4 py-2.5 font-sans text-base font-medium text-stone-600 transition hover:bg-white/90 hover:text-stone-900"
            >
              {t('coachLanding.ctaLogin')}
            </button>
            <button type="button" onClick={goRegister} className={primaryBtn}>
              {t('coachLanding.ctaRegister')}
            </button>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-10">
          <div className="mb-2 flex justify-center sm:hidden" role="group" aria-label="Langue">
            {SUPPORTED_LOCALES.map(({ code }) => (
              <button
                key={code}
                type="button"
                onClick={() => setStoreLocale(code)}
                className={`rounded-full px-3 py-2 font-sans text-xs font-bold uppercase tracking-wider ${
                  (locale || 'fr') === code
                    ? 'bg-stone-800 text-white'
                    : 'mx-0.5 border border-stone-200 bg-white/80 text-stone-500'
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <span className="inline-flex rounded-full border border-violet-200/90 bg-white/80 px-5 py-2 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-violet-700 shadow-sm backdrop-blur-sm sm:text-sm">
              {t('coachLanding.tagline')}
            </span>
            <h1 className="mx-auto mt-6 max-w-4xl font-serif text-[1.85rem] font-semibold leading-[1.15] tracking-tight text-stone-900 sm:text-4xl md:text-[2.35rem]">
              {t('coachLanding.heroTitle')}
            </h1>
            <p className="mx-auto mt-6 max-w-3xl font-sans text-base leading-relaxed text-stone-700 sm:text-lg">
              {t('coachLanding.heroSubtitle')}
            </p>
          </motion.div>

          <ul className="mx-auto mt-12 grid max-w-5xl list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 md:gap-5">
            {pillars.map(({ icon, titleKey, descKey, tint }, i) => (
              <motion.li
                key={titleKey}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className={`flex h-full flex-col gap-3 rounded-2xl border bg-gradient-to-br p-6 shadow-sm sm:p-7 ${tint}`}>
                  <span className="text-3xl" aria-hidden>
                    {icon}
                  </span>
                  <h2 className="font-serif text-xl font-semibold text-stone-900 sm:text-2xl">{t(titleKey)}</h2>
                  <p className="font-sans text-sm leading-relaxed text-stone-600 sm:text-[0.95rem]">{t(descKey)}</p>
                </div>
              </motion.li>
            ))}
          </ul>

          <h2 className="mt-16 text-center font-serif text-2xl font-semibold tracking-tight text-stone-900 sm:mt-20 sm:text-3xl">
            {t('coachLanding.benefitsTitle')}
          </h2>
          <ul className="mx-auto mt-8 grid max-w-6xl list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {benefitRows.map(({ icon, titleKey, descKey }, i) => (
              <motion.li
                key={titleKey}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-24px' }}
                transition={{ delay: (i % 3) * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex gap-4 rounded-2xl border border-stone-200/80 bg-white/75 p-4 shadow-sm backdrop-blur-sm sm:p-5"
              >
                <span className="text-2xl shrink-0" aria-hidden>
                  {icon}
                </span>
                <div className="min-w-0">
                  <p className="font-sans text-base font-semibold text-stone-900">{t(titleKey)}</p>
                  <p className="mt-1.5 font-sans text-sm leading-relaxed text-stone-600">{t(descKey)}</p>
                </div>
              </motion.li>
            ))}
          </ul>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="mx-auto mt-14 max-w-3xl rounded-2xl border border-amber-200/80 bg-amber-50/50 p-6 sm:mt-16 sm:p-8"
          >
            <h2 className="font-serif text-lg font-semibold text-stone-900 sm:text-xl">{t('coachLanding.disclaimerTitle')}</h2>
            <p className="mt-3 font-sans text-sm leading-relaxed text-stone-600 sm:text-[0.95rem]">
              {t('coachLanding.disclaimerDesc')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="mx-auto mt-12 max-w-2xl rounded-[1.5rem] border border-violet-200/70 bg-gradient-to-br from-violet-50/95 to-white p-8 text-center shadow-[0_20px_50px_-20px_rgba(91,33,182,0.2)] sm:p-10"
          >
            <h2 className="font-serif text-2xl font-semibold text-stone-900 sm:text-3xl">{t('coachLanding.ctaTitle')}</h2>
            <p className="mx-auto mt-4 max-w-lg font-sans text-sm leading-relaxed text-stone-600 sm:text-base">
              {t('coachLanding.ctaLead')}
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap">
              <button type="button" onClick={goRegister} className={`${primaryBtn} w-full sm:w-auto`}>
                {t('coachLanding.ctaRegister')}
              </button>
              <button type="button" onClick={goLogin} className={`${secondaryBtn} w-full sm:w-auto`}>
                {t('coachLanding.ctaLogin')}
              </button>
            </div>
            <Link
              href="/coaches"
              className="mt-6 inline-block font-sans text-sm font-semibold text-violet-700 underline decoration-violet-300 decoration-2 underline-offset-4 hover:text-violet-900"
            >
              {t('coachLanding.ctaCoaches')} →
            </Link>
          </motion.div>
        </div>
      </main>

      <footer className="relative mt-auto border-t border-violet-200/40 bg-gradient-to-t from-violet-50/30 to-transparent py-8">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="font-serif text-sm leading-relaxed text-stone-500 sm:text-base">{t('coachLanding.footerNote')}</p>
        </div>
      </footer>
    </div>
  )
}
