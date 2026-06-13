'use client'

import { t } from '@/i18n'

type GalaxieLegendProps = {
  collapsed?: boolean
  onToggle?: () => void
}

export function GalaxieLegend({ collapsed = false, onToggle }: GalaxieLegendProps) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="px-2 py-1 rounded-lg text-[10px] text-slate-300 bg-slate-950/72 border border-slate-600/40 backdrop-blur-md"
        aria-expanded={false}
      >
        {t('prairie.legendTitle')} ▾
      </button>
    )
  }

  return (
    <div
      className="p-2.5 rounded-xl border border-slate-600/40 bg-slate-950/78 backdrop-blur-md shadow-lg text-[10px] text-slate-300 space-y-1.5 max-w-[11rem]"
      role="note"
      aria-label={t('prairie.legendTitle')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-amber-100/90 uppercase tracking-wide text-[9px]">
          {t('prairie.legendTitle')}
        </span>
        {onToggle && (
          <button type="button" onClick={onToggle} className="text-slate-500 hover:text-slate-300" aria-label={t('common.close')}>
            ▴
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block w-5 h-0.5 rounded bg-violet-400/80" />
        <span>{t('prairie.legendDuo')}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block w-5 h-0.5 rounded bg-cyan-400/50 border-dashed border-t border-cyan-300/40" />
        <span>{t('prairie.legendResonance')}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
        <span>{t('prairie.legendOnline')}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-full bg-amber-300/30 ring-1 ring-amber-400/50" />
        <span>{t('prairie.legendContact')}</span>
      </div>
      <p className="text-[9px] text-slate-500 pt-0.5 leading-snug">{t('prairie.legendHint')}</p>
    </div>
  )
}
