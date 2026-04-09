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
  /** `sliderOnly` : uniquement le curseur (pas la rangée de cartes). */
  variant?: 'full' | 'sliderOnly'
  /** Affiche un lien pour relancer le défilement auto (vue zen). */
  showResumeAuto?: boolean
  onResumeAuto?: () => void
}

/** Date courte pour légendes / cartes (export pour la vue zen). */
export function formatZenSnapshotDate(iso: string | undefined, locale: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const map: Record<string, string> = {
      fr: 'fr-FR',
      en: 'en-GB',
      es: 'es-ES',
      de: 'de-DE',
      it: 'it-IT',
    }
    return d.toLocaleDateString(map[locale] ?? 'fr-FR', {
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return ''
  }
}

export function FleurTimeScroll({
  snapshots,
  selectedIndex,
  onSelect,
  className = '',
  variant = 'full',
  showResumeAuto = false,
  onResumeAuto,
}: FleurTimeScrollProps) {
  const locale = useStore((s) => s.locale)
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (variant === 'sliderOnly') return
    const i = selectedIndex < 0 ? 0 : selectedIndex + 1
    const el = itemRefs.current[i]
    if (!el || !scrollRef.current) return
    const container = scrollRef.current
    const elLeft = el.offsetLeft
    const elWidth = el.offsetWidth
    const containerWidth = container.offsetWidth
    const targetScrollLeft = elLeft - containerWidth / 2 + elWidth / 2
    container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' })
  }, [selectedIndex, variant])

  const n = snapshots.length
  const maxSlider = Math.max(0, n)
  const sliderOnly = variant === 'sliderOnly'

  return (
    <div className={`w-full max-w-2xl mx-auto space-y-3 ${className}`}>
      <p className="text-center text-[10px] uppercase tracking-[0.2em] text-slate-500/80 dark:text-slate-400/80">
        {sliderOnly ? t('fleurZen.timeScrollSliderOnlyTitle') : t('fleurZen.timeScrollTitle')}
      </p>
      {!sliderOnly ? (
        <div
          ref={scrollRef}
          className="flex flex-nowrap gap-2 overflow-x-auto pb-2 pt-1 px-1 scroll-smooth snap-x snap-mandatory [scrollbar-width:thin]"
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
                  {formatZenSnapshotDate(snap.date, locale)}
                </span>
                <span className="text-xs font-medium line-clamp-2">{snap.label || snap.type || '—'}</span>
              </motion.button>
            )
          })}
        </div>
      ) : null}
      {n > 0 ? (
        <div className="px-1 space-y-2">
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
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-teal-400/80 bg-white/10"
          />
          {showResumeAuto && onResumeAuto ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onResumeAuto}
                className="text-[10px] uppercase tracking-[0.16em] text-teal-300/80 hover:text-teal-200 border border-teal-500/35 hover:border-teal-400/50 px-3 py-1.5 rounded-full transition-colors"
              >
                {t('fleurZen.timeResumeAuto')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
