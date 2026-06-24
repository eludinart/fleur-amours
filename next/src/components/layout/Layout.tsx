'use client'

import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import Link from 'next/link'
import { Sidebar } from './Sidebar'
import { ToastContainer } from './Toast'
import { ImpersonationBanner } from '../ImpersonationBanner'
import { LambdaViewBanner } from '../LambdaViewBanner'
import { ViewModeSelector } from '../ViewModeSelector'
import { SapGauge } from '../SapGauge'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/contexts/AuthContext'
import { useStore } from '@/store/useStore'
import { setLocale as setI18nLocale, t } from '@/i18n'
import { billingApi } from '@/api/billing'
import { socialApi } from '@/api/social'
import NotificationCenter from '../NotificationCenter'
import { LanguageSelector } from './LanguageSelector'
import { FormBackBar } from './FormBackBar'
import { OnboardingTour } from '../OnboardingTour'
import { CoachRequestModal } from '../CoachRequestModal'
import { HelpChatbot } from '../HelpChatbot'
import { clearAuthBearer } from '@/lib/api-client'

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [access, setAccess] = useState<{
    token_balance?: number
    eternal_sap?: number
    total_accumulated_eternal?: number
  } | null>(null)
  const { user, refreshUser } = useAuth()
  const { theme, toggle } = useTheme()
  const fontSizePreference = useStore((s) => s.fontSizePreference)
  const locale = useStore((s) => s.locale)
  /** Même rendu que les enfants : évite que t() reste en fr après réhydratation persist (useEffect trop tard, sans re-render). */
  if (typeof window !== 'undefined') {
    setI18nLocale(locale || 'fr')
  }
  const headerRef = useRef<HTMLElement>(null)
  const refreshAccessInFlight = useRef<Promise<void> | null>(null)

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSizePreference === 'large' ? 'large' : ''
  }, [fontSizePreference])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('impersonation_restored') !== '1') return
    sessionStorage.removeItem('impersonate_restore')
    sessionStorage.removeItem('impersonating')
    sessionStorage.removeItem('impersonate_admin_user')
    clearAuthBearer()
    void refreshUser()
    params.delete('impersonation_restored')
    const qs = params.toString()
    const path = window.location.pathname
    window.history.replaceState(null, '', qs ? `${path}?${qs}` : path)
  }, [refreshUser])

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
    const onSapUpdated = () => refresh()
    window.addEventListener('fleur:sap-updated', onSapUpdated)

    // Petit polling (évite les compteurs figés en session longue)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 60000)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('fleur:sap-updated', onSapUpdated)
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
        <LambdaViewBanner />
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
          {/*
            Mobile : on n'expose qu'un wordmark discret. La navigation se fait via le drawer (☰),
            qui partage la même source de vérité que le sidebar desktop (Sidebar.tsx).
            On supprime ainsi la mini-barre horizontale qui dupliquait — et désynchronisait — le menu.
          */}
          <Link
            href="/"
            className="md:hidden flex items-center gap-1.5 min-w-0 text-sm font-bold text-accent truncate"
          >
            <span aria-hidden>🏡</span>
            <span className="truncate">{t('nav.home') ?? 'Mon Jardin'}</span>
          </Link>
          <span className="flex-1" />
          <div className="shrink-0 flex items-center gap-1 sm:gap-2">
            <ViewModeSelector />
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
          id="jardin-main-scroll"
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
      <CoachRequestModal />
      {user ? <OnboardingTour /> : null}
      {user ? <HelpChatbot /> : null}
    </div>
  )
}
