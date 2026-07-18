'use client'

import { useStore } from '@/store/useStore'
import { t } from '@/i18n'

export const FONT_SIZE_OPTIONS = [
  { id: 'normal', labelKey: 'fontNormal', sample: 'A' },
  { id: 'large', labelKey: 'fontLarge', sample: 'A' },
  { id: 'xlarge', labelKey: 'fontXLarge', sample: 'A' },
] as const

export type FontSizePreference = (typeof FONT_SIZE_OPTIONS)[number]['id']

export function normalizeFontSizePreference(v: unknown): FontSizePreference {
  if (v === 'large' || v === 'xlarge') return v
  return 'normal'
}

type FontSizeSelectorProps = {
  /** compact = bouton header ; full = sélecteur Compte */
  variant?: 'compact' | 'full'
  className?: string
}

/**
 * Préférence d’accessibilité : taille de police (persistée Zustand).
 * Scale rem globale via html[data-font-size].
 */
export function FontSizeSelector({ variant = 'compact', className = '' }: FontSizeSelectorProps) {
  const raw = useStore((s) => s.fontSizePreference)
  const setFontSizePreference = useStore((s) => s.setFontSizePreference)
  const value = normalizeFontSizePreference(raw)

  function cycle() {
    const idx = FONT_SIZE_OPTIONS.findIndex((o) => o.id === value)
    const next = FONT_SIZE_OPTIONS[(idx + 1) % FONT_SIZE_OPTIONS.length]
    setFontSizePreference(next.id)
  }

  if (variant === 'compact') {
    const label =
      value === 'xlarge' ? t('fontXLarge') : value === 'large' ? t('fontLarge') : t('fontNormal')
    return (
      <button
        type="button"
        onClick={cycle}
        className={`flex items-center justify-center min-w-[44px] min-h-[44px] px-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors ${className}`}
        aria-label={`${t('fontSize')}: ${label}`}
        title={`${t('fontSize')}: ${label}`}
      >
        <span className="relative inline-flex items-end justify-center gap-0.5 font-serif font-semibold leading-none">
          <span className="text-[11px] opacity-70">A</span>
          <span
            className={
              value === 'xlarge' ? 'text-lg' : value === 'large' ? 'text-base' : 'text-sm'
            }
          >
            A
          </span>
        </span>
      </button>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('fontSize')}>
        {FONT_SIZE_OPTIONS.map((opt) => {
          const active = value === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setFontSizePreference(opt.id)}
              className={`flex-1 min-w-[5.5rem] px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                active
                  ? 'border-violet-500 bg-violet-500 text-white shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-violet-300 dark:hover:border-violet-700'
              }`}
            >
              <span
                className={`block font-serif leading-none mb-1 ${
                  opt.id === 'xlarge' ? 'text-2xl' : opt.id === 'large' ? 'text-xl' : 'text-base'
                }`}
                aria-hidden
              >
                {opt.sample}
              </span>
              {t(opt.labelKey)}
            </button>
          )
        })}
      </div>
      <p className="text-ai-prose text-slate-600 dark:text-slate-300 italic border border-dashed border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-white/50 dark:bg-slate-900/40">
        {t('fontSizePreview')}
      </p>
    </div>
  )
}
