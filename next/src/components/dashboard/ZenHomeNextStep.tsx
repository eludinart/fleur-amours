'use client'

import Link from 'next/link'
import { t } from '@/i18n'

export function ZenHomeNextStep({
  currentSession,
  hasPetals,
  chronicleCount,
}: {
  currentSession?: { status?: string } | null
  hasPetals: boolean
  chronicleCount: number
}) {
  const inProgress = currentSession?.status === 'in_progress'

  if (inProgress) {
    return (
      <Link
        href="/session"
        className="block mb-5 rounded-2xl border-2 border-violet-500/40 bg-violet-950/40 hover:border-violet-400/60 px-4 py-4 transition-colors"
      >
        <p className="text-xs font-medium text-violet-300/90">👉 {t('dashboard.nextStep')}</p>
        <p className="text-base font-semibold text-violet-50 mt-0.5">{t('dashboard.resumeSession')}</p>
        <p className="text-xs text-white/45 mt-1">{t('dashboard.sessionInProgress')}</p>
      </Link>
    )
  }

  if (!hasPetals && chronicleCount === 0) {
    return (
      <Link
        href="/a-deux/par-une-porte?welcome=1"
        className="block mb-5 rounded-2xl border-2 border-rose-500/35 bg-rose-950/30 hover:border-rose-400/50 px-4 py-4 transition-colors"
      >
        <p className="text-xs font-medium text-rose-300/90">👉 {t('dashboard.startHere')}</p>
        <p className="text-base font-semibold text-rose-50 mt-0.5">{t('dashboard.completeFleur')}</p>
        <p className="text-xs text-white/45 mt-1">{t('dashboard.fleurDesc')}</p>
      </Link>
    )
  }

  return (
    <Link
      href="/tirage"
      className="block mb-5 rounded-2xl border-2 border-amber-500/30 bg-amber-950/25 hover:border-amber-400/45 px-4 py-4 transition-colors"
    >
      <p className="text-xs font-medium text-amber-300/90">👉 {t('dashboard.suggestion')}</p>
      <p className="text-base font-semibold text-amber-50 mt-0.5">{t('dashboard.launchReading')}</p>
      <p className="text-xs text-white/45 mt-1">{t('dashboard.readingDesc')}</p>
    </Link>
  )
}
