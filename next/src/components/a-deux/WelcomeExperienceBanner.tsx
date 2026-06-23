'use client'

import { t } from '@/i18n'

export function WelcomeExperienceBanner() {
  return (
    <div className="rounded-2xl border border-violet-200/70 dark:border-violet-500/40 bg-gradient-to-r from-violet-50 to-rose-50 dark:from-violet-950/50 dark:to-rose-950/30 px-4 py-3 mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
        {t('welcomeExperience.badge')}
      </p>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-0.5">
        {t('welcomeExperience.title')}
      </p>
      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
        {t('welcomeExperience.body')}
      </p>
    </div>
  )
}
