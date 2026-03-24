'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useStore } from '@/store/useStore'
import { t } from '@/i18n'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

export function SapGauge({
  tokenBalance = 0,
  eternalSap = 0,
  totalAccumulatedEternal = 0,
  size = 36,
  showLabel = true,
  className = '',
}: {
  tokenBalance?: number
  eternalSap?: number
  totalAccumulatedEternal?: number
  size?: number
  showLabel?: boolean
  className?: string
}) {
  const [hover, setHover] = useState(false)
  const [clickOpen, setClickOpen] = useState(false)
  const sapTooltipSeen = useStore((s) => s.sapTooltipSeen)
  const setSapTooltipSeen = useStore((s) => s.setSapTooltipSeen)
  const [showFirstTime, setShowFirstTime] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sapTooltipSeen) {
      const id = setTimeout(() => setShowFirstTime(true), 1500)
      return () => clearTimeout(id)
    }
  }, [sapTooltipSeen])

  const handleDismissFirstTime = () => {
    setShowFirstTime(false)
    setSapTooltipSeen(true)
  }

  const total = tokenBalance + eternalSap
  const hasAura = totalAccumulatedEternal >= 200
  const showTooltip = hover || clickOpen
  const tooltipText = `${t('sap.sablier')}: ${tokenBalance} · ${t('sap.cristal')}: ${eternalSap}`

  useEffect(() => {
    if (!clickOpen) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setClickOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [clickOpen])

  return (
    <div
      ref={ref}
      className={`relative inline-flex items-center gap-1.5 cursor-pointer select-none ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => setClickOpen((o) => !o)}
      role="button"
      tabIndex={0}
      aria-expanded={showTooltip}
      aria-haspopup="dialog"
      onKeyDown={(e) => e.key === 'Enter' && setClickOpen((o) => !o)}
      title={tooltipText}
    >
      <div
        className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${
          hasAura ? 'ring-2 ring-slate-300/80 dark:ring-slate-500/60' : ''
        }`}
        style={{
          width: size,
          height: size,
          filter: hasAura ? 'drop-shadow(0 0 6px rgba(192,192,208,0.5))' : undefined,
        }}
      >
        {hasAura && (
          <div
            className="absolute inset-0 rounded-full opacity-40 animate-pulse"
            style={{
              background: 'radial-gradient(circle, rgba(192,192,208,0.6) 0%, transparent 70%)',
              filter: 'blur(4px)',
            }}
          />
        )}
        <div
          className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center font-bold text-xs text-white bg-gradient-to-br from-emerald-500 to-teal-600 shadow-inner"
          title={tooltipText}
        >
          {total}
        </div>
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('sap.label')}</span>
      )}
      {showTooltip &&
        ref.current &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[9999] px-2.5 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-[10px] font-medium whitespace-nowrap shadow-lg pointer-events-none"
            style={{
              top:
                ref.current.getBoundingClientRect().top -
                ref.current.getBoundingClientRect().height -
                8,
              left:
                ref.current.getBoundingClientRect().left +
                ref.current.getBoundingClientRect().width / 2,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {t('sap.sablier')}: {tokenBalance}
              </span>
              <span className="text-slate-400">|</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                {t('sap.cristal')}: {eternalSap}
              </span>
            </div>
            {totalAccumulatedEternal >= 200 && (
              <p className="mt-0.5 text-amber-200/90 text-[9px]">{t('sap.auraUnlocked')}</p>
            )}
          </div>,
          document.body
        )}
      {showFirstTime &&
        !sapTooltipSeen &&
        ref.current &&
        createPortal(
          <div
            role="dialog"
            aria-label={t('sap.ariaLabel')}
            className="fixed z-[9999] w-56 px-3 py-3 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-xs shadow-xl border border-slate-600"
            style={{
              top: ref.current.getBoundingClientRect().top - 160,
              left:
                ref.current.getBoundingClientRect().left +
                ref.current.getBoundingClientRect().width / 2,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="font-semibold mb-1">{t('onboarding.sapFirstTimeTitle')}</p>
            <p className="text-slate-300 text-[11px] leading-relaxed mb-2">
              {t('onboarding.sapFirstTimeDesc')}
            </p>
            <Link
              href="/account"
              onClick={(e) => {
                e.stopPropagation()
                handleDismissFirstTime()
              }}
              className="block text-center py-1.5 text-[11px] text-emerald-300 hover:text-emerald-200 underline mb-2"
            >
              {t('onboarding.sapFirstTimeLink')}
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleDismissFirstTime()
              }}
              className="w-full py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-[11px] font-medium transition-colors"
            >
              {t('onboarding.gotIt')}
            </button>
          </div>,
          document.body
        )}
    </div>
  )
}
