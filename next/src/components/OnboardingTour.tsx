'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useStore } from '@/store/useStore'
import { t } from '@/i18n'

const SESSION_KEY = 'fleur_post_register_onboarding'

export function OnboardingTour() {
  const { user, loading } = useAuth()
  const hasSeen = useStore((s) => s.hasSeenOnboardingTour)
  const setSeen = useStore((s) => s.setHasSeenOnboardingTour)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

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
        setStep(0)
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

  if (!open) return null

  const total = 4
  const progressLabel = t('onboarding.wizardStep', { current: step + 1, total })

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-wizard-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-violet-200/60 dark:border-violet-500/30 bg-white dark:bg-slate-900 shadow-2xl shadow-violet-950/20 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500" aria-hidden />
        <div className="p-6 sm:p-8 space-y-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            {progressLabel}
          </p>

          {step === 0 && (
            <>
              <h2 id="onboarding-wizard-title" className="text-xl font-bold text-slate-900 dark:text-slate-50">
                {t('onboarding.welcomeTitle')}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {t('onboarding.welcomeSubtitle')}
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <h2 id="onboarding-wizard-title" className="text-xl font-bold text-slate-900 dark:text-slate-50">
                {t('onboarding.postRegisterWaysTitle')}
              </h2>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex gap-2">
                  <span className="shrink-0 text-violet-500" aria-hidden>
                    ◆
                  </span>
                  <span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{t('onboarding.pillarDiscover')} — </span>
                    {t('onboarding.pillarDiscoverDesc')}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 text-violet-500" aria-hidden>
                    ◆
                  </span>
                  <span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{t('onboarding.pillarExplore')} — </span>
                    {t('onboarding.pillarExploreDesc')}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 text-violet-500" aria-hidden>
                    ◆
                  </span>
                  <span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{t('onboarding.pillarAccompany')} — </span>
                    {t('onboarding.pillarAccompanyDesc')}
                  </span>
                </li>
              </ul>
            </>
          )}

          {step === 2 && (
            <>
              <h2 id="onboarding-wizard-title" className="text-xl font-bold text-slate-900 dark:text-slate-50">
                {t('onboarding.postRegisterNavTitle')}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {t('onboarding.postRegisterNavBody')}
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <h2 id="onboarding-wizard-title" className="text-xl font-bold text-slate-900 dark:text-slate-50">
                {t('onboarding.postRegisterCreditsTitle')}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {t('onboarding.postRegisterCreditsBody')}
              </p>
            </>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between sm:items-center pt-2">
            <button
              type="button"
              onClick={finish}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-300 px-2 py-2 text-center sm:text-left"
            >
              {t('onboarding.skip')}
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {t('onboarding.back')}
                </button>
              )}
              {step < total - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-rose-500 shadow-lg shadow-rose-500/25 hover:opacity-95 transition-opacity"
                >
                  {t('onboarding.next')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-rose-500 shadow-lg shadow-rose-500/25 hover:opacity-95 transition-opacity"
                >
                  {t('onboarding.exploreGarden')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
