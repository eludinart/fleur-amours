'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { t, setLocale as syncI18nLocale, SUPPORTED_LOCALES } from '@/i18n'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function MyceliumBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(160deg, #f4f8f6 0%, #eef7f2 35%, #f7f5ef 70%, #fbfaf6 100%)',
        }}
      />
      <div className="absolute -top-28 right-[-9%] h-[22rem] w-[22rem] rounded-full bg-emerald-200/40 blur-[76px] sm:h-[28rem] sm:w-[28rem]" />
      <div className="absolute top-[34%] -left-20 h-[18rem] w-[18rem] rounded-full bg-teal-200/35 blur-[64px]" />
      <div className="absolute bottom-[-10%] left-1/2 h-[13rem] w-[min(125%,42rem)] -translate-x-1/2 rounded-full bg-lime-100/45 blur-[46px]" />
    </div>
  )
}

export function MyceliumLandingPage() {
  const locale = useStore((s) => s.locale)
  const setStoreLocale = useStore((s) => s.setLocale)
  const router = useRouter()

  if (typeof window !== 'undefined') {
    syncI18nLocale(locale || 'fr')
  }

  const goLogin = () => router.push(`${basePath}/login`)
  const goRegister = () => router.push(`${basePath}/login?mode=register`)

  const primaryBtn =
    'inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 px-7 py-3 text-base font-semibold tracking-wide text-white shadow-[0_10px_28px_-8px_rgba(6,95,70,0.35)] transition hover:shadow-[0_14px_36px_-8px_rgba(6,95,70,0.42)] sm:px-8 sm:py-3.5'
  const secondaryBtn =
    'inline-flex items-center justify-center rounded-full border-2 border-stone-300/90 bg-white/90 px-6 py-2.5 text-base font-semibold text-stone-800 shadow-sm transition hover:border-emerald-400/80 hover:bg-white sm:px-7 sm:py-3'

  const pillars = [
    { icon: '🕸️', titleKey: 'myceliumLanding.p1Title', descKey: 'myceliumLanding.p1Desc' },
    { icon: '🧭', titleKey: 'myceliumLanding.p2Title', descKey: 'myceliumLanding.p2Desc' },
    { icon: '🤝', titleKey: 'myceliumLanding.p3Title', descKey: 'myceliumLanding.p3Desc' },
  ] as const

  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <MyceliumBackdrop />

      <header className="sticky top-0 z-20 border-b border-emerald-200/45 bg-[rgba(245,250,247,0.88)] py-2.5 backdrop-blur-md sm:py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
            <Link href="/" className="flex min-w-0 items-center gap-3 rounded-xl pr-1 transition hover:opacity-90">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-md shadow-emerald-300/35 ring-2 ring-white/80 sm:h-11 sm:w-11">
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
                <p className="hidden font-sans text-xs uppercase tracking-[0.16em] text-emerald-700/85 sm:block">
                  {t('myceliumLanding.tagline')}
                </p>
              </div>
            </Link>
            <Link
              href="/"
              className="font-sans text-sm font-medium text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-4 hover:text-emerald-900"
            >
              {t('myceliumLanding.navHome')}
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
            <button type="button" onClick={goLogin} className="rounded-full px-4 py-2.5 font-sans text-base font-medium text-stone-600 transition hover:bg-white/90 hover:text-stone-900">
              {t('myceliumLanding.ctaLogin')}
            </button>
            <button type="button" onClick={goRegister} className={primaryBtn}>
              {t('myceliumLanding.ctaRegister')}
            </button>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <span className="inline-flex rounded-full border border-emerald-200/90 bg-white/80 px-5 py-2 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 shadow-sm backdrop-blur-sm sm:text-sm">
              {t('myceliumLanding.badge')}
            </span>
            <h1 className="mx-auto mt-6 max-w-4xl font-serif text-[1.9rem] font-semibold leading-[1.15] tracking-tight text-stone-900 sm:text-4xl md:text-[2.4rem]">
              {t('myceliumLanding.heroTitle')}
            </h1>
            <p className="mx-auto mt-6 max-w-3xl font-sans text-base leading-relaxed text-stone-700 sm:text-lg">
              {t('myceliumLanding.heroSubtitle')}
            </p>
          </motion.div>

          <ul className="mx-auto mt-12 grid max-w-6xl list-none grid-cols-1 gap-4 p-0 md:grid-cols-3 md:gap-5">
            {pillars.map(({ icon, titleKey, descKey }, i) => (
              <motion.li
                key={titleKey}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/75 to-white p-6 shadow-sm sm:p-7"
              >
                <span className="text-3xl" aria-hidden>{icon}</span>
                <h2 className="mt-3 font-serif text-xl font-semibold text-stone-900 sm:text-2xl">{t(titleKey)}</h2>
                <p className="mt-2 font-sans text-sm leading-relaxed text-stone-600 sm:text-[0.95rem]">{t(descKey)}</p>
              </motion.li>
            ))}
          </ul>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="mx-auto mt-14 max-w-4xl rounded-[1.5rem] border border-teal-200/70 bg-gradient-to-br from-teal-50/90 to-white p-7 text-center shadow-[0_20px_50px_-20px_rgba(6,95,70,0.2)] sm:p-9"
          >
            <h2 className="font-serif text-2xl font-semibold text-stone-900 sm:text-3xl">{t('myceliumLanding.ctaTitle')}</h2>
            <p className="mx-auto mt-4 max-w-2xl font-sans text-sm leading-relaxed text-stone-600 sm:text-base">
              {t('myceliumLanding.ctaLead')}
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap">
              <button type="button" onClick={goRegister} className={`${primaryBtn} w-full sm:w-auto`}>
                {t('myceliumLanding.ctaRegister')}
              </button>
              <button type="button" onClick={goLogin} className={`${secondaryBtn} w-full sm:w-auto`}>
                {t('myceliumLanding.ctaLogin')}
              </button>
            </div>
          </motion.div>
        </div>
      </main>

      <footer className="relative mt-auto border-t border-emerald-200/40 bg-gradient-to-t from-emerald-50/35 to-transparent py-8">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="font-serif text-sm leading-relaxed text-stone-500 sm:text-base">{t('myceliumLanding.footerNote')}</p>
        </div>
      </footer>
    </div>
  )
}
