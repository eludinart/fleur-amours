'use client'

import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

export type TimeScrollSnapshot = {
  id: string | number
  date?: string
  label?: string
  type?: string
}

type FleurTimeScrollProps = {
  snapshots: TimeScrollSnapshot[]
  /** -1 = présent (agrégat live), 0..n-1 = index dans snapshots */
  selectedIndex: number
  onSelect: (index: number) => void
  className?: string
}

function formatWhen(iso: string | undefined, locale: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(locale === 'en' ? 'en-GB' : locale === 'es' ? 'es-ES' : 'fr-FR', {
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return ''
  }
}

export function FleurTimeScroll({ snapshots, selectedIndex, onSelect, className = '' }: FleurTimeScrollProps) {
  const locale = useStore((s) => s.locale)
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const i = selectedIndex < 0 ? 0 : selectedIndex + 1
    const el = itemRefs.current[i]
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedIndex])

  const n = snapshots.length
  const maxSlider = Math.max(0, n)

  return (
    <div className={`w-full max-w-md mx-auto space-y-3 ${className}`}>
      <p className="text-center text-[10px] uppercase tracking-[0.2em] text-slate-500/80 dark:text-slate-400/80">
        {t('fleurZen.timeScrollTitle')}
      </p>
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 pt-1 px-1 scroll-smooth snap-x snap-mandatory [scrollbar-width:thin]"
        role="tablist"
        aria-label={t('fleurZen.timeScrollAria')}
      >
        <motion.button
          type="button"
          ref={(el) => {
            itemRefs.current[0] = el
          }}
          role="tab"
          aria-selected={selectedIndex < 0}
          onClick={() => onSelect(-1)}
          className={`snap-center shrink-0 min-w-[4.5rem] rounded-2xl border px-3 py-2 text-left transition-all ${
            selectedIndex < 0
              ? 'border-teal-400/50 bg-teal-500/15 text-teal-100 shadow-[0_0_20px_rgba(45,212,191,0.15)]'
              : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
          }`}
          whileTap={{ scale: 0.97 }}
        >
          <span className="block text-[9px] uppercase tracking-wider opacity-70">{t('fleurZen.timeNow')}</span>
          <span className="text-xs font-medium">{t('fleurZen.timeAggregate')}</span>
        </motion.button>
        {snapshots.map((snap, idx) => {
          const active = selectedIndex === idx
          return (
            <motion.button
              key={`${snap.id}-${idx}`}
              type="button"
              ref={(el) => {
                itemRefs.current[idx + 1] = el
              }}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(idx)}
              className={`snap-center shrink-0 max-w-[9rem] rounded-2xl border px-3 py-2 text-left transition-all ${
                active
                  ? 'border-violet-400/45 bg-violet-500/12 text-violet-100 shadow-[0_0_18px_rgba(139,92,246,0.12)]'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
              }`}
              whileTap={{ scale: 0.97 }}
            >
              <span className="block text-[9px] uppercase tracking-wider opacity-70 truncate">
                {formatWhen(snap.date, locale)}
              </span>
              <span className="text-xs font-medium line-clamp-2">{snap.label || snap.type || '—'}</span>
            </motion.button>
          )
        })}
      </div>
      {n > 0 && (
        <div className="px-1">
          <label className="sr-only" htmlFor="fleur-time-scroll-range">
            {t('fleurZen.timeScrollSlider')}
          </label>
          <input
            id="fleur-time-scroll-range"
            type="range"
            min={-1}
            max={maxSlider - 1}
            step={1}
            value={selectedIndex}
            onChange={(e) => onSelect(Number(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer accent-teal-400/80 bg-white/10"
          />
        </div>
      )}
    </div>
  )
}
