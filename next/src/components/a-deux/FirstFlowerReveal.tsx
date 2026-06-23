'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FlowerSVG, scoresToPetals, PETAL_DEFS } from '@/components/FlowerSVG'
import { dominantPetalId } from '@/lib/petal-tarot'
import { markFirstFlowerDone } from '@/lib/first-experience'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

type FirstFlowerRevealProps = {
  scores: Record<string, number>
  onInviteLater?: () => void
  showInvite?: boolean
  children?: React.ReactNode
}

function petalLabel(petalId: string): string {
  const key = `fleurZen.petalLabels.${petalId}`
  const s = t(key)
  return s !== key ? s : PETAL_DEFS.find((p) => p.id === petalId)?.name ?? petalId
}

export function FirstFlowerReveal({ scores, onInviteLater, showInvite, children }: FirstFlowerRevealProps) {
  const router = useRouter()
  useStore((s) => s.locale)
  const petals = useMemo(() => scoresToPetals(scores), [scores])
  const dominant = useMemo(() => dominantPetalId(scores), [scores])
  const dominantName = dominant ? petalLabel(dominant) : ''

  function goGarden() {
    markFirstFlowerDone()
    router.push('/?celebrate=1')
  }

  function goReading() {
    markFirstFlowerDone()
    const petal = dominant ? `?petal=${encodeURIComponent(dominant)}&welcome=1` : '?welcome=1'
    router.push(`/tirage${petal}`)
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-violet-200/60 dark:border-violet-500/30 bg-gradient-to-b from-violet-50 via-white to-rose-50 dark:from-slate-900 dark:via-slate-950 dark:to-violet-950/40 p-6 sm:p-8 space-y-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_30%,rgba(167,139,250,0.22),transparent)]" aria-hidden />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative text-center space-y-2"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">
          {t('firstFlower.badge')}
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50">
          {t('firstFlower.title')}
        </h2>
        {dominantName ? (
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
            {t('firstFlower.dominantLine', { petal: dominantName })}
          </p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">{t('firstFlower.subtitle')}</p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex justify-center py-2"
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-violet-400/20 blur-3xl motion-safe:animate-pulse" aria-hidden />
        </div>
        <FlowerSVG petals={petals} size={280} animate showLabels showScores />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="relative flex flex-col gap-2 sm:flex-row sm:justify-center"
      >
        <button
          type="button"
          onClick={goGarden}
          className="px-6 py-3.5 rounded-full font-semibold text-white bg-gradient-to-r from-violet-600 to-rose-500 shadow-lg shadow-rose-500/25 hover:opacity-95 transition-opacity"
        >
          {t('firstFlower.ctaGarden')}
        </button>
        <button
          type="button"
          onClick={goReading}
          className="px-6 py-3.5 rounded-full font-semibold border-2 border-violet-300/80 dark:border-violet-500/50 text-violet-800 dark:text-violet-100 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors"
        >
          {t('firstFlower.ctaReading')}
        </button>
      </motion.div>

      <p className="relative text-center text-xs text-slate-500 dark:text-slate-400">
        {t('firstFlower.firstDrawFree')}
      </p>

      {showInvite && children ? (
        <details className="relative text-sm">
          <summary className="cursor-pointer text-center text-slate-500 hover:text-violet-600 dark:hover:text-violet-300">
            {t('firstFlower.inviteLater')}
          </summary>
          <div className="mt-4">{children}</div>
        </details>
      ) : null}

      {onInviteLater ? (
        <button type="button" onClick={onInviteLater} className="sr-only">
          skip
        </button>
      ) : null}
    </div>
  )
}
