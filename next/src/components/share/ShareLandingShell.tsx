'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

export function ShareLandingChipRow({ items }: { items: readonly string[] }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((label) => (
        <span
          key={label}
          className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-slate-200/95 sm:text-xs"
        >
          {label}
        </span>
      ))}
    </div>
  )
}

type ShareLandingShellProps = {
  children: ReactNode
  brandName: string
  brandLine: string
  freeLabel: string
  footerMicro: string
  primaryCta: { href: string; label: string }
  secondaryCta?: { href: string; label: string }
  /** Variante fond : alignée sur OG tirage / dreamscape (sombre) ou OG fleur (clair) */
  variant?: 'dark' | 'warm'
}

/**
 * Enveloppe commune des pages de partage : même grille sémantique que les cartes OG,
 * avec zone basse fixe pour CTA (suite du parcours utilisateur).
 */
export function ShareLandingShell({
  children,
  brandName,
  brandLine,
  freeLabel,
  footerMicro,
  primaryCta,
  secondaryCta,
  variant = 'dark',
}: ShareLandingShellProps) {
  const isDark = variant === 'dark'

  return (
    <div
      className={
        isDark
          ? 'relative flex min-h-[100dvh] flex-col overflow-x-hidden text-white'
          : 'relative flex min-h-[100dvh] flex-col overflow-x-hidden text-[#1a1008]'
      }
      style={
        isDark
          ? {
              background: 'linear-gradient(148deg, #020617 0%, #1e1b4b 48%, #0f172a 100%)',
            }
          : {
              background: 'linear-gradient(165deg, #fffbf5 0%, #f7ead8 35%, #fdf6ee 70%, #faf0e6 100%)',
            }
      }
    >
      {isDark ? (
        <>
          <div
            className="pointer-events-none absolute -right-16 -top-24 h-[min(480px,50vw)] w-[min(480px,50vw)] rounded-full bg-indigo-500/20 blur-[88px]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-20 left-6 h-[min(340px,45vw)] w-[min(340px,45vw)] rounded-full bg-pink-500/[0.11] blur-[70px]"
            aria-hidden
          />
        </>
      ) : (
        <>
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-violet-500/[0.08] blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-amber-500/[0.06] blur-3xl"
            aria-hidden
          />
        </>
      )}

      <header className="relative z-10 flex items-start justify-between gap-4 px-5 pt-7 sm:px-8 sm:pt-9">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div
            className={
              isDark
                ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/35 bg-gradient-to-br from-violet-500/35 to-pink-500/20 text-lg sm:h-10 sm:w-10'
                : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-900/15 bg-gradient-to-br from-rose-500/20 to-violet-500/15 text-lg sm:h-10 sm:w-10'
            }
            aria-hidden
          >
            ✿
          </div>
          <div className="min-w-0">
            <p
              className={`truncate text-base font-bold tracking-tight sm:text-lg ${isDark ? 'text-violet-50' : 'text-[#2d1c0e]'}`}
            >
              {brandName}
            </p>
            <p
              className={`mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] sm:text-[11px] ${isDark ? 'text-violet-200/75' : 'text-amber-900/55'}`}
            >
              {brandLine}
            </p>
            <div
              className={`mt-2 h-0.5 w-24 rounded-full ${isDark ? 'bg-gradient-to-r from-violet-300/90 via-pink-400/40 to-transparent' : 'bg-gradient-to-r from-rose-500/55 via-violet-500/45 to-transparent'}`}
              aria-hidden
            />
          </div>
        </div>
        <div
          className={
            isDark
              ? 'shrink-0 rounded-full border border-amber-300/45 bg-gradient-to-br from-amber-300/20 to-pink-400/15 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-100 shadow-[0_4px_24px_rgba(250,204,21,0.12)] sm:px-4 sm:text-xs'
              : 'shrink-0 rounded-full border border-amber-800/25 bg-white/80 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-900 sm:px-4 sm:text-xs'
          }
        >
          {freeLabel}
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col px-4 pb-40 pt-4 sm:px-8 sm:pb-44 sm:pt-6">
        {children}
      </main>

      <footer
        className={
          isDark
            ? 'fixed bottom-0 left-0 right-0 z-20 border-t border-violet-500/25 bg-[#020617]/85 backdrop-blur-md'
            : 'fixed bottom-0 left-0 right-0 z-20 border-t border-amber-900/15 bg-[#fdf8f0]/95 backdrop-blur-md'
        }
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-3.5">
          <p
            className={`text-center text-xs font-semibold leading-snug sm:text-left sm:text-sm ${isDark ? 'text-slate-300/85' : 'text-amber-950/70'}`}
          >
            <span className="mr-1.5 opacity-90" aria-hidden>
              ✿
            </span>
            {footerMicro}
          </p>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Link
              href={primaryCta.href}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-6 py-3 text-center text-base font-extrabold tracking-tight text-white shadow-[0_12px_40px_rgba(124,58,237,0.45)] transition hover:opacity-95 sm:min-w-[200px] sm:px-7 sm:text-lg"
            >
              {primaryCta.label} →
            </Link>
            {secondaryCta ? (
              <Link
                href={secondaryCta.href}
                className={`text-center text-xs font-medium underline-offset-2 sm:text-sm ${isDark ? 'text-violet-300 hover:text-violet-200' : 'text-violet-800 hover:text-violet-700'} underline`}
              >
                {secondaryCta.label}
              </Link>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  )
}
