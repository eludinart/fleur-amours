'use client'

import Link from 'next/link'
import { t } from '@/i18n'

export type DuoJourneyStep = 'questionnaire' | 'duo'

type DuoJourneyNavProps = {
  current: DuoJourneyStep
}

const STEPS: { id: DuoJourneyStep; href: string; icon: string; labelKey: string; hintKey: string }[] = [
  {
    id: 'questionnaire',
    href: '/a-deux',
    icon: '1',
    labelKey: 'duoJourney.stepQuestionnaireLabel',
    hintKey: 'duoJourney.stepQuestionnaireHint',
  },
  {
    id: 'duo',
    href: '/mes-duos',
    icon: '2',
    labelKey: 'duoJourney.stepDuoLabel',
    hintKey: 'duoJourney.stepDuoHint',
  },
]

function stepIndex(step: DuoJourneyStep) {
  return STEPS.findIndex((s) => s.id === step)
}

export function DuoJourneyNav({ current }: DuoJourneyNavProps) {
  const currentIdx = stepIndex(current)

  return (
    <nav aria-label={t('duoJourney.navLabel')} className="rounded-2xl border border-violet-200/80 bg-violet-50/50 dark:border-violet-900/50 dark:bg-violet-950/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-700 dark:text-violet-300 mb-3">
        {t('duoJourney.title')}
      </p>
      <ol className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        {STEPS.map((step, idx) => {
          const isCurrent = step.id === current
          const isPast = idx < currentIdx
          const label = t(step.labelKey)
          const hint = t(step.hintKey)

          const shell = `rounded-xl border px-3 py-3 text-left transition-colors ${
            isCurrent
              ? 'border-violet-400 bg-white shadow-sm ring-2 ring-violet-300/50 dark:border-violet-600 dark:bg-slate-900 dark:ring-violet-700/40'
              : isPast
                ? 'border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                : 'border-slate-200/80 bg-white/60 dark:border-slate-700 dark:bg-slate-900/40'
          }`

          const inner = (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent
                      ? 'bg-violet-600 text-white'
                      : isPast
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isPast ? '✓' : step.icon}
                </span>
                <span className={`text-sm font-semibold ${isCurrent ? 'text-violet-900 dark:text-violet-100' : 'text-slate-800 dark:text-slate-200'}`}>
                  {label}
                </span>
              </div>
              <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400 pl-8">{hint}</p>
              {isCurrent ? (
                <p className="mt-2 pl-8 text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                  {t('duoJourney.youAreHere')}
                </p>
              ) : null}
            </>
          )

          if (isCurrent) {
            return (
              <li key={step.id} className={shell}>
                {inner}
              </li>
            )
          }

          return (
            <li key={step.id}>
              <Link href={step.href} className={`block ${shell} hover:border-violet-300 dark:hover:border-violet-700`}>
                {inner}
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
