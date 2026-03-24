'use client'

import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '@/store/useStore'
import { SUPPORTED_LOCALES, t } from '@/i18n'

const FLAGS: Record<string, string> = { fr: '🇫🇷', en: '🇬🇧', es: '🇪🇸' }

export function LanguageSelector() {
  const locale = (useStore((s) => s.locale) || 'fr') as string
  const setLocale = useStore((s) => s.setLocale)
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const updatePosition = () => {
      if (!btnRef.current) return
      const rect = btnRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-lang-selector]')) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = SUPPORTED_LOCALES.find((l) => l.code === locale) || SUPPORTED_LOCALES[0]

  return (
    <div data-lang-selector="" className="shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors"
        aria-label={t('layout.changeLanguage')}
        title={t('layout.changeLanguage')}
        aria-expanded={open}
      >
        <span className="text-base leading-none">{FLAGS[locale] ?? '🌐'}</span>
        <span className="hidden sm:inline uppercase tracking-wide text-xs font-semibold">
          {current.code}
        </span>
        <svg
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            data-lang-selector=""
            style={dropdownStyle}
            className="w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/60 dark:shadow-slate-950/80 py-1 z-[9999] overflow-hidden"
          >
            {SUPPORTED_LOCALES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLocale(l.code)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  l.code === locale
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                }`}
              >
                <span className="text-base leading-none">{FLAGS[l.code] ?? '🌐'}</span>
                <span>{l.label}</span>
                {l.code === locale && (
                  <svg
                    className="ml-auto w-3.5 h-3.5 text-accent"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}
