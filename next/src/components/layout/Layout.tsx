'use client'

import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { ToastContainer } from './Toast'
import { ImpersonationBanner } from '../ImpersonationBanner'
import { SapGauge } from '../SapGauge'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/contexts/AuthContext'
import { useStore } from '@/store/useStore'
import { setLocale as setI18nLocale } from '@/i18n'
import { billingApi } from '@/api/billing'
import { socialApi } from '@/api/social'
import NotificationCenter from '../NotificationCenter'
import { LanguageSelector } from './LanguageSelector'
import { FormBackBar } from './FormBackBar'
import { OnboardingTour } from '../OnboardingTour'
import { t } from '@/i18n'

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [access, setAccess] = useState<{
    token_balance?: number
    eternal_sap?: number
    total_accumulated_eternal?: number
  } | null>(null)
  const { user, isAdmin } = useAuth()
  const { theme, toggle } = useTheme()
  const fontSizePreference = useStore((s) => s.fontSizePreference)
  const locale = useStore((s) => s.locale)
  const headerRef = useRef<HTMLElement>(null)
  const pathname = usePathname() || ''
  const pathWithoutBase = pathname.replace('/jardin', '').replace(/^\/+|\/+$/g, '') || ''
  const refreshAccessInFlight = useRef<Promise<void> | null>(null)

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSizePreference === 'large' ? 'large' : ''
  }, [fontSizePreference])

  useEffect(() => {
    setI18nLocale(locale || 'fr')
  }, [locale])

  useEffect(() => {
    if (!user?.id) {
      setAccess(null)
      return
    }
    const refresh = () => {
      if (refreshAccessInFlight.current) return refreshAccessInFlight.current
      refreshAccessInFlight.current = billingApi
        .getAccess()
        .then((a) => setAccess(a as typeof access))
        .catch(() => setAccess(null))
        .finally(() => {
          refreshAccessInFlight.current = null
        }) as Promise<void>
      return refreshAccessInFlight.current
    }

    // Premier chargement
    refresh()

    // Rafraîchir au retour sur l'onglet (utile après crédit admin, achat boutique, etc.)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Petit polling (évite les compteurs figés en session longue)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 60000)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [(user as { id?: string })?.id])

  useEffect(() => {
    const uid = (user as { id?: string })?.id
    if (!uid) return
    const tick = () => {
      if (document.visibilityState === 'visible') {
        socialApi.presenceHeartbeat().catch(() => {})
      }
    }
    tick()
    const interval = setInterval(tick, 45000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [(user as { id?: string })?.id])

  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--layout-header-h', `${el.offsetHeight}px`)
    })
    ro.observe(el)
    document.documentElement.style.setProperty('--layout-header-h', `${el.offsetHeight}px`)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ImpersonationBanner />
        <header
          ref={headerRef}
          className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 min-w-0 overflow-hidden relative z-10"
        >
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="md:hidden flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-lg shrink-0 text-slate-700 dark:text-slate-100 text-2xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-accent/50"
            aria-label={t('common.menu')}
            title={t('common.menu')}
          >
            ☰
          </button>
          <nav className="md:hidden flex items-center gap-1 flex-1 min-w-0 overflow-x-auto overflow-y-hidden flex-nowrap scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {[
              { to: '/dreamscape', labelKey: 'dreamscapeShort', icon: '🌙' },
              { to: '/session', labelKey: 'nav.session', icon: '🌿' },
              { to: '/fleur', labelKey: 'nav.fleur', icon: '🌸' },
              { to: '/duo', labelKey: 'nav.duo', icon: '💕' },
              { to: '/mes-fleurs', labelKey: 'nav.mesFleurs', icon: '📄' },
              { to: '/tirage', labelKey: 'nav.tirages', icon: '🎴' },
              ...(isAdmin ? [{ to: '/admin', labelKey: 'nav.adminDashboard', icon: '📊' }, { to: '/campaigns', labelKey: 'campaigns', icon: '✉️' }] : []),
            ].map(({ to, labelKey, icon }) => {
              const isActive = pathWithoutBase === to.replace(/^\//, '') || (pathWithoutBase === '' && to === '/')
              return (
                <Link
                  key={to}
                  href={to}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 min-w-0 ${
                    isActive ? 'bg-accent/10 text-accent' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base shrink-0">{icon}</span>
                  <span className="truncate w-full text-center">{t(labelKey)}</span>
                </Link>
              )
            })}
          </nav>
          <span className="hidden md:block flex-1" />
          <div className="shrink-0 flex items-center gap-1 sm:gap-2">
            {user && (
              <SapGauge
                tokenBalance={access?.token_balance ?? 0}
                eternalSap={access?.eternal_sap ?? 0}
                totalAccumulatedEternal={access?.total_accumulated_eternal ?? 0}
                size={32}
                showLabel={false}
              />
            )}
            <LanguageSelector />
            <button
              onClick={toggle}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-lg shrink-0"
              aria-label={t('layout.toggleTheme')}
              title={t('layout.toggleTheme')}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <NotificationCenter />
            </div>
          </div>
        </header>

        <main
          key={locale}
          className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden overscroll-none p-4 pb-[max(1rem,env(safe-area-inset-bottom,48px))] md:p-6 md:pb-6"
        >
          <FormBackBar />
          <div className="flex-1 min-h-0 flex flex-col">
            {children}
          </div>
        </main>
      </div>

      <ToastContainer />
      {user ? <OnboardingTour /> : null}
    </div>
  )
}
