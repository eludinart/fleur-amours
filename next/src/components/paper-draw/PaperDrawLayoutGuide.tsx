'use client'

import { PETAL_DEFS } from '@/lib/petal-theme'
import type { PaperDrawLayoutDef } from '@/lib/paper-draw-layouts'
import { t } from '@/i18n'

type Props = {
  layout: PaperDrawLayoutDef
}

export function PaperDrawLayoutGuide({ layout }: Props) {
  if (layout.id === 'flower_8') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-64 h-64 sm:w-72 sm:h-72">
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-rose-200 dark:border-rose-800/60" />
          <div className="absolute inset-[28%] rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 flex items-center justify-center text-[10px] text-center text-rose-400 px-2">
            {t('paperDraw.flowerCenter')}
          </div>
          {PETAL_DEFS.map((p) => {
            const rad = ((p.angle - 90) * Math.PI) / 180
            const r = 42
            const x = 50 + r * Math.cos(rad)
            const y = 50 + r * Math.sin(rad)
            return (
              <div
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
                style={{ left: `${x}%`, top: `${y}%`, width: '4.5rem' }}
              >
                <div
                  className="mx-auto w-8 h-8 rounded-full border-2 flex items-center justify-center text-[9px] font-bold shadow-sm"
                  style={{ borderColor: p.color, backgroundColor: p.bg, color: p.color }}
                >
                  {p.name.slice(0, 3)}
                </div>
                <p className="text-[9px] sm:text-[10px] font-medium text-slate-600 dark:text-slate-400 mt-0.5 leading-tight">
                  {p.name}
                </p>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-md">
          {t(layout.flexHintKey)}
        </p>
      </div>
    )
  }

  if (layout.id === 'four_doors') {
    return (
      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto w-full">
        {layout.slots.map((slot, i) => {
          const colors = [
            'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
            'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
            'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
            'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
          ]
          return (
            <div
              key={slot.id}
              className={`rounded-xl border-2 border-dashed p-4 min-h-[5rem] flex flex-col items-center justify-center text-center ${colors[i] ?? colors[0]}`}
            >
              <span className="text-lg font-bold">{i + 1}</span>
              <span className="text-sm font-semibold">{slot.label}</span>
              {slot.hint && (
                <span className="text-[10px] opacity-80 mt-0.5">{slot.hint}</span>
              )}
            </div>
          )
        })}
        <p className="col-span-2 text-xs text-slate-500 dark:text-slate-400 text-center">
          {t(layout.flexHintKey)}
        </p>
      </div>
    )
  }

  if (layout.id === 'free') {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 p-8 text-center max-w-md mx-auto">
        <p className="text-4xl mb-3">✨</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t(layout.flexHintKey)}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap justify-center gap-3 max-w-lg mx-auto">
      {layout.slots.map((slot, i) => (
        <div
          key={slot.id}
          className="flex-1 min-w-[7rem] rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/30 p-4 text-center"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {i + 1}
          </span>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">{slot.label}</p>
        </div>
      ))}
      <p className="w-full text-xs text-slate-500 dark:text-slate-400 text-center mt-1">
        {t(layout.flexHintKey)}
      </p>
    </div>
  )
}
