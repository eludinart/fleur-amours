'use client'

import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

/** Bandeau discret, une fois par appareil (persisté), avec fermeture explicite */
export function ContextualHint({
  hintId,
  messageKey,
  className = '',
}: {
  hintId: string
  messageKey: string
  className?: string
}) {
  const dismissed = useStore((s) => s.dismissedContextualHints)
  const dismiss = useStore((s) => s.dismissContextualHint)
  if (dismissed.includes(hintId)) return null

  return (
    <div
      className={`relative rounded-xl border border-violet-200/55 dark:border-violet-800/45 bg-gradient-to-r from-violet-50/80 to-transparent dark:from-violet-950/35 dark:to-transparent px-3.5 py-2.5 pr-10 text-xs text-slate-600 dark:text-slate-300 leading-relaxed shadow-sm ${className}`}
      role="note"
    >
      <p>{t(messageKey)}</p>
      <button
        type="button"
        onClick={() => dismiss(hintId)}
        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-violet-100/80 hover:text-slate-700 dark:hover:bg-violet-900/50 dark:hover:text-slate-100 transition-colors"
        aria-label={t('onboarding.hintDismissAria')}
      >
        <span className="text-lg leading-none">×</span>
      </button>
    </div>
  )
}
