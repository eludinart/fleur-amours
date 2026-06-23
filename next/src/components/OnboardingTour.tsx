'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useStore } from '@/store/useStore'
import { t } from '@/i18n'

const SESSION_KEY = 'fleur_post_register_onboarding'

/** Tour léger : oriente vers l'action (Fleur) plutôt qu'un catalogue de fonctionnalités. */
export function OnboardingTour() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const hasSeen = useStore((s) => s.hasSeenOnboardingTour)
  const setSeen = useStore((s) => s.setHasSeenOnboardingTour)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (hasSeen) {
      try {
        sessionStorage.removeItem(SESSION_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [hasSeen])

  useEffect(() => {
    if (loading || !user || hasSeen) return
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') {
        setOpen(true)
      }
    } catch {
      /* ignore */
    }
  }, [loading, user, hasSeen])

  const finish = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
    setSeen(true)
    setOpen(false)
  }, [setSeen])

  const startFlower = useCallback(() => {
    finish()
    router.push('/a-deux/par-une-porte?welcome=1')
  }, [finish, router])

  const startReading = useCallback(() => {
    finish()
    router.push('/tirage?welcome=1')
  }, [finish, router])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-wizard-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-violet-200/60 dark:border-violet-500/30 bg-white dark:bg-slate-900 shadow-2xl shadow-violet-950/20 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500" aria-hidden />
        <div className="p-6 sm:p-8 space-y-5 text-center">
          <p className="text-4xl" aria-hidden>
            🌸
          </p>
          <h2 id="onboarding-wizard-title" className="text-xl font-bold text-slate-900 dark:text-slate-50">
            {t('onboarding.actionTitle')}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('onboarding.actionSubtitle')}
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={startFlower}
              className="w-full px-5 py-3.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-rose-500 shadow-lg shadow-rose-500/25 hover:opacity-95 transition-opacity"
            >
              {t('onboarding.actionFlowerCta')}
            </button>
            <button
              type="button"
              onClick={startReading}
              className="w-full px-5 py-3 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {t('onboarding.actionReadingCta')}
            </button>
          </div>

          <button
            type="button"
            onClick={finish}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-300"
          >
            {t('onboarding.exploreGarden')}
          </button>
        </div>
      </div>
    </div>
  )
}
