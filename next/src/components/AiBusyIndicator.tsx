'use client'

import type { ReactNode } from 'react'
import { formatAiElapsed, useAiBusy } from '@/hooks/useAiBusy'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

type AiBusyIndicatorProps = {
  /** Affiche l'indicateur quand true */
  active: boolean
  /** Libellé court (sinon i18n aiBusy.thinking) */
  label?: string
  /** Variante visuelle */
  variant?: 'inline' | 'banner' | 'overlay'
  className?: string
  /** Chronomètre déjà calculé (sinon calculé ici via useAiBusy) */
  elapsedSec?: number
}

/**
 * Indicateur universel « l'IA réfléchit » + temps écoulé.
 * À placer près de la zone de réponse / sous le formulaire.
 */
export function AiBusyIndicator({
  active,
  label,
  variant = 'inline',
  className = '',
  elapsedSec: elapsedProp,
}: AiBusyIndicatorProps) {
  useStore((s) => s.locale)
  const { elapsedSec: elapsedHook } = useAiBusy(active && elapsedProp == null)
  const elapsedSec = elapsedProp ?? elapsedHook
  if (!active) return null

  const text = label || t('aiBusy.thinking')
  const time = formatAiElapsed(elapsedSec)
  const display = time ? `${text} · ${time}` : text

  if (variant === 'overlay') {
    return (
      <div
        className={`absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-slate-950/55 backdrop-blur-[2px] ${className}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900/90 border border-white/15 shadow-xl">
          <span
            className="w-7 h-7 border-2 border-violet-300/40 border-t-violet-400 rounded-full animate-spin"
            aria-hidden
          />
          <p className="text-sm text-white/90 font-medium text-center">{display}</p>
          <p className="text-[11px] text-white/50 text-center">{t('aiBusy.pleaseWait')}</p>
        </div>
      </div>
    )
  }

  if (variant === 'banner') {
    return (
      <div
        className={`flex items-center gap-3 w-full rounded-xl border border-violet-400/25 bg-violet-950/40 px-3 py-2.5 ${className}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span
          className="shrink-0 w-5 h-5 border-2 border-violet-300/40 border-t-violet-400 rounded-full animate-spin"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-violet-100 font-medium truncate">{display}</p>
          <p className="text-[11px] text-violet-200/60">{t('aiBusy.pleaseWait')}</p>
        </div>
      </div>
    )
  }

  return (
    <p
      className={`text-xs sm:text-sm text-violet-300/90 italic text-center animate-pulse ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {display}
    </p>
  )
}

type AiBusyLockProps = {
  active: boolean
  children: ReactNode
  className?: string
  /** Affiche l'overlay par-dessus les enfants */
  showOverlay?: boolean
  label?: string
}

/**
 * Enveloppe un formulaire : bloque les interactions pendant l'appel IA.
 */
export function AiBusyLock({
  active,
  children,
  className = '',
  showOverlay = false,
  label,
}: AiBusyLockProps) {
  return (
    <div
      className={`relative ${active ? 'select-none' : ''} ${className}`}
      aria-busy={active}
      data-ai-busy={active ? '1' : undefined}
    >
      <div className={active ? 'pointer-events-none opacity-[0.72]' : undefined}>
        {children}
      </div>
      {showOverlay && active ? (
        <AiBusyIndicator active variant="overlay" label={label} />
      ) : null}
    </div>
  )
}
