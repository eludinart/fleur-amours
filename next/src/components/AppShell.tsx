'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { setLocaleForRequests, isCapacitor } from '@/lib/api-client'
import { useStore } from '@/store/useStore'
import { Layout } from '@/components/layout/Layout'
import { LoginPage } from '@/views/LoginPage'
import { LandingPage } from '@/views/LandingPage'
import { HomePage } from '@/views/HomePage'
import { PresentationPage } from '@/views/PresentationPage'
import { AccountPage } from '@/views/AccountPage'
import { CoachesDirectoryPage } from '@/views/CoachesDirectoryPage'
import { ChatPage } from '@/views/ChatPage'
import NotificationsPage from '@/views/NotificationsPage'
import NotificationPreferencesPage from '@/views/NotificationPreferencesPage'
import StatsPage from '@/views/StatsPage'
import CampaignsPage from '@/views/CampaignsPage'
import DiagnosticPage from '@/views/DiagnosticPage'
import GraphPage from '@/views/GraphPage'
import SciencePage from '@/views/SciencePage'
import MatrixPage from '@/views/MatrixPage'
import TarotPage from '@/views/TarotPage'
import SessionPage from '@/views/SessionPage'
import { SessionErrorBoundary } from '@/components/SessionErrorBoundary'
import FleurPage from '@/views/FleurPage'
import FleurBetaPage from '@/views/FleurBetaPage'
import DuoPage from '@/views/DuoPage'
import MesFleursPage from '@/views/MesFleursPage'
import CardsPage from '@/views/CardsPage'
import DreamscapePage from '@/views/DreamscapePage'
import DreamscapeHistoriquePage from '@/views/DreamscapeHistoriquePage'
import DreamscapePartagePage from '@/views/DreamscapePartagePage'
import TiragePartagePage from '@/views/TiragePartagePage'
import PrairiePage from '@/views/PrairiePage'
import UserLisierePage from '@/views/UserLisierePage'
import ClairierePage from '@/views/ClairierePage'
import BoutiquePage from '@/views/BoutiquePage'
import AdminDashboardPage from '@/views/AdminDashboardPage'
import AdminTiragesPage from '@/views/AdminTiragesPage'
import AdminChatPage from '@/views/AdminChatPage'
import AdminPromptsPage from '@/views/AdminPromptsPage'
import AdminPromoPage from '@/views/AdminPromoPage'
import AdminNotificationsPage from '@/views/AdminNotificationsPage'
import AdminUsersPage from '@/views/AdminUsersPage'
import AdminSessionsPage from '@/views/AdminSessionsPage'
import AdminSciencePage from '@/views/AdminSciencePage'
import AdminBroadcastsPage from '@/views/AdminBroadcastsPage'
import AdminTelemetryPage from '@/views/AdminTelemetryPage'
import CoachSuiviPage from '@/views/CoachSuiviPage'
import CoachPatientelePage from '@/views/CoachPatientelePage'
import PushNotificationPriming from '@/components/PushNotificationPriming'

const AdminAnalyticsPage = dynamic(
  () => import('@/views/AdminAnalyticsPage').then((m) => m.default),
  { ssr: false }
)

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

/** Aligné sur AuthContext.bootstrap : indique qu’une session est plausible avant la fin de me(). */
function readAuthSessionHint(): boolean {
  if (typeof window === 'undefined') return false
  return (
    !!localStorage.getItem('auth_user') ||
    (isCapacitor() && !!localStorage.getItem('auth_token'))
  )
}

/** Placeholder léger : même famille visuelle que la landing, sans CTA connexion (évite flash « hors app »). */
function HomeAuthLoadingShell() {
  return (
    <div className="scrollbar-cream min-h-[100svh] min-h-[100dvh] min-h-0 w-full flex items-center justify-center overflow-hidden bg-[#fdf6ed]">
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600"
        aria-hidden
      />
    </div>
  )
}

function RedirectHome() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/')
  }, [router])
  return null
}

function getPathSegments(pathname: string): string[] {
  const p = pathname.replace(/^\/+|\/+$/g, '') || ''
  return p ? p.split('/') : []
}

function ProtectedLayout({
  children,
  adminOnly = false,
  adminOrCoach = false,
}: {
  children: React.ReactNode
  adminOnly?: boolean
  adminOrCoach?: boolean
}) {
  const { user, loading, isAdmin, isCoach } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(`/login?from=${encodeURIComponent(pathname || '/')}`)
      return
    }
    if (adminOnly && !isAdmin) router.replace('/')
    if (adminOrCoach && !isAdmin && !isCoach) router.replace('/')
  }, [user, loading, isAdmin, isCoach, adminOnly, adminOrCoach, router, pathname])

  if (loading) {
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center bg-slate-900">
        <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return null
  if (adminOnly && !isAdmin) return null
  if (adminOrCoach && !isAdmin && !isCoach) return null

  return <>{children}</>
}

function LocaleSync() {
  const locale = useStore((s) => s.locale)
  useEffect(() => {
    setLocaleForRequests(locale || 'fr')
  }, [locale])
  return null
}

function AppRoutes() {
  const pathname = usePathname()
  const { user, loading, isAdmin, isCoach } = useAuth()
  const [routesMounted, setRoutesMounted] = useState(false)
  const segments = getPathSegments(pathname?.replace(basePath, '') || '')
  const route = segments[0] || 'home'
  const subRoute = segments[1]
  const subRoute2 = segments[2]

  useEffect(() => {
    setRoutesMounted(true)
  }, [])

  // Home + chargement auth : ne pas afficher la landing (CTA login/register) si une session est plausible —
  // sinon les utilisateurs connectés voyaient la landing une fraction de seconde puis le tableau de bord.
  // Avant hydratation client, pas de lecture localStorage : placeholder léger identique SSR/1er paint.
  if (loading && route === 'home') {
    if (!routesMounted) {
      return (
        <Suspense fallback={null}>
          <LocaleSync />
          <HomeAuthLoadingShell />
        </Suspense>
      )
    }
    if (!readAuthSessionHint()) {
      return (
        <Suspense fallback={null}>
          <LocaleSync />
          <div className="scrollbar-cream min-h-[100svh] min-h-[100dvh] min-h-0 w-full overflow-y-auto overflow-x-hidden">
            <LandingPage />
          </div>
        </Suspense>
      )
    }
    return (
      <Suspense fallback={null}>
        <LocaleSync />
        <HomeAuthLoadingShell />
      </Suspense>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center bg-slate-900">
        <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  // Login / Register - redirect if already logged in
  if (route === 'login' || route === 'register') {
    if (user) return <RedirectHome />
    return <LoginPage />
  }

  // Public: TiragePartagePage (no Layout, no auth)
  if (route === 'tirage' && subRoute === 'partage' && subRoute2) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900"><span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" /></div>}>
        <div className="flex-1 min-h-screen min-h-[100dvh] flex flex-col overflow-hidden bg-slate-900">
          <LocaleSync />
          <TiragePartagePage />
        </div>
      </Suspense>
    )
  }

  // Public: DreamscapePartagePage (no Layout, no auth)
  if (route === 'dreamscape' && subRoute === 'partage' && subRoute2) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900"><span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" /></div>}>
        <div className="flex-1 min-h-screen min-h-[100dvh] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
          <LocaleSync />
          <DreamscapePartagePage />
        </div>
      </Suspense>
    )
  }

  const PageFallback = () => (
    <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-900">
      <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
    </div>
  )

  // Protected routes with Layout (Sidebar, topbar, etc.)
  const protectedPages: Record<string, React.ReactNode> = {
    prairie: (
      <ProtectedLayout>
        <Suspense fallback={
          <Layout>
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
            </div>
          </Layout>
        }>
          <Layout>
            <PrairiePage />
          </Layout>
        </Suspense>
      </ProtectedLayout>
    ),
    lisiere: (
      <ProtectedLayout>
        <Layout>
          <UserLisierePage />
        </Layout>
      </ProtectedLayout>
    ),
    clairiere: (
      <ProtectedLayout>
        <Layout>
          <ClairierePage />
        </Layout>
      </ProtectedLayout>
    ),
    boutique: (
      <ProtectedLayout>
        <Layout>
          <BoutiquePage />
        </Layout>
      </ProtectedLayout>
    ),
    home: (
      <ProtectedLayout>
        <Layout>
          <HomePage />
        </Layout>
      </ProtectedLayout>
    ),
    presentation: (
      <ProtectedLayout>
        <Layout>
          <PresentationPage />
        </Layout>
      </ProtectedLayout>
    ),
    tirage: (
      <ProtectedLayout>
        <Layout>
          <TarotPage />
        </Layout>
      </ProtectedLayout>
    ),
    dreamscape: subRoute === 'historique' ? (
      <ProtectedLayout>
        <Layout>
          <DreamscapeHistoriquePage />
        </Layout>
      </ProtectedLayout>
    ) : (
      <ProtectedLayout>
        <Layout>
          <DreamscapePage />
        </Layout>
      </ProtectedLayout>
    ),
    session: (
      <ProtectedLayout>
        <Layout>
          <SessionErrorBoundary>
            <SessionPage />
          </SessionErrorBoundary>
        </Layout>
      </ProtectedLayout>
    ),
    fleur: (
      <ProtectedLayout>
        <Layout>
          <FleurPage />
        </Layout>
      </ProtectedLayout>
    ),
    'fleur-beta': (
      <ProtectedLayout>
        <Layout>
          <FleurBetaPage />
        </Layout>
      </ProtectedLayout>
    ),
    duo: (
      <ProtectedLayout>
        <Layout>
          <DuoPage />
        </Layout>
      </ProtectedLayout>
    ),
    'mes-fleurs': (
      <ProtectedLayout>
        <Layout>
          <MesFleursPage />
        </Layout>
      </ProtectedLayout>
    ),
    cartes: (
      <ProtectedLayout>
        <Layout>
          <CardsPage />
        </Layout>
      </ProtectedLayout>
    ),
    coaches: (
      <ProtectedLayout>
        <Layout>
          <CoachesDirectoryPage />
        </Layout>
      </ProtectedLayout>
    ),
    chat: (
      <ProtectedLayout>
        <Layout>
          <Suspense
            fallback={
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
              </div>
            }
          >
            <ChatPage />
          </Suspense>
        </Layout>
      </ProtectedLayout>
    ),
    account: (
      <ProtectedLayout>
        <Layout>
          <AccountPage />
        </Layout>
      </ProtectedLayout>
    ),
    notifications:
      subRoute === 'preferences' ? (
        <ProtectedLayout>
          <Layout>
            <NotificationPreferencesPage />
          </Layout>
        </ProtectedLayout>
      ) : (
        <ProtectedLayout>
          <Layout>
            <NotificationsPage />
          </Layout>
        </ProtectedLayout>
      ),
    graph: (
      <ProtectedLayout>
        <Layout>
          <GraphPage />
        </Layout>
      </ProtectedLayout>
    ),
    science: (
      <ProtectedLayout>
        <Layout>
          <SciencePage />
        </Layout>
      </ProtectedLayout>
    ),
    matrix: (
      <ProtectedLayout>
        <Layout>
          <MatrixPage />
        </Layout>
      </ProtectedLayout>
    ),
  }

  // Admin routes (adminOnly or adminOrCoach)
  if (route === 'admin') {
    const adminSubRoute = subRoute || ''
    const adminPages: Record<string, React.ReactNode> = {
      '': (
        <ProtectedLayout adminOnly>
          <Layout>
            <AdminDashboardPage />
          </Layout>
        </ProtectedLayout>
      ),
      suivi: (
        <ProtectedLayout adminOrCoach>
          <Layout>
            <CoachSuiviPage />
          </Layout>
        </ProtectedLayout>
      ),
      patientele: (
        <ProtectedLayout adminOrCoach>
          <Layout>
            <CoachPatientelePage />
          </Layout>
        </ProtectedLayout>
      ),
      sessions: (
        <ProtectedLayout adminOnly>
          <Layout>
            <AdminSessionsPage />
          </Layout>
        </ProtectedLayout>
      ),
      tirages: (
        <ProtectedLayout adminOnly>
          <Layout>
            <AdminTiragesPage />
          </Layout>
        </ProtectedLayout>
      ),
      users: (
        <ProtectedLayout adminOnly>
          <Layout>
            <AdminUsersPage />
          </Layout>
        </ProtectedLayout>
      ),
      chat: (
        <ProtectedLayout adminOrCoach>
          <Layout>
            <AdminChatPage />
          </Layout>
        </ProtectedLayout>
      ),
      prompts: (
        <ProtectedLayout adminOnly>
          <Layout>
            <AdminPromptsPage />
          </Layout>
        </ProtectedLayout>
      ),
      promo: (
        <ProtectedLayout adminOnly>
          <Layout>
            <AdminPromoPage />
          </Layout>
        </ProtectedLayout>
      ),
      notifications: (
        <ProtectedLayout adminOnly>
          <Layout>
            <AdminNotificationsPage />
          </Layout>
        </ProtectedLayout>
      ),
      broadcasts: (
        <ProtectedLayout adminOnly>
          <Layout>
            <AdminBroadcastsPage />
          </Layout>
        </ProtectedLayout>
      ),
      analytics: (
        <ProtectedLayout adminOrCoach>
          <Layout>
            <AdminAnalyticsPage />
          </Layout>
        </ProtectedLayout>
      ),
      science: (
        <ProtectedLayout adminOnly>
          <Layout>
            <AdminSciencePage />
          </Layout>
        </ProtectedLayout>
      ),
      telemetry: (
        <ProtectedLayout adminOnly>
          <Layout>
            <AdminTelemetryPage />
          </Layout>
        </ProtectedLayout>
      ),
    }
    const adminPage = adminPages[adminSubRoute] ?? adminPages[''] ?? adminPages.sessions
    if (adminPage) return (
      <Suspense fallback={<PageFallback />}>
        <div className="flex-1 min-h-screen min-h-[100dvh] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
          <LocaleSync />
          {adminPage}
        </div>
      </Suspense>
    )
  }

  // Coach routes (coach-only space; still uses shared pages)
  if (route === 'coach') {
    const coachSubRoute = subRoute || ''
    const coachPages: Record<string, React.ReactNode> = {
      '': (
        <ProtectedLayout adminOrCoach>
          <Layout>
            <CoachSuiviPage />
          </Layout>
        </ProtectedLayout>
      ),
      suivi: (
        <ProtectedLayout adminOrCoach>
          <Layout>
            <CoachSuiviPage />
          </Layout>
        </ProtectedLayout>
      ),
      analytics: (
        <ProtectedLayout adminOrCoach>
          <Layout>
            <AdminAnalyticsPage />
          </Layout>
        </ProtectedLayout>
      ),
      patientele: (
        <ProtectedLayout adminOrCoach>
          <Layout>
            <CoachPatientelePage />
          </Layout>
        </ProtectedLayout>
      ),
      chat: (
        <ProtectedLayout adminOrCoach>
          <Layout>
            <AdminChatPage />
          </Layout>
        </ProtectedLayout>
      ),
    }

    const coachPage = coachPages[coachSubRoute] ?? coachPages[''] ?? coachPages.suivi
    if (coachPage) {
      return (
        <Suspense fallback={<PageFallback />}>
          <div className="flex-1 min-h-screen min-h-[100dvh] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
            <LocaleSync />
            {coachPage}
          </div>
        </Suspense>
      )
    }
  }

  // Stats, campaigns, diagnostic, etc. (protected or admin)
  if (route === 'stats') {
    return (
      <Suspense fallback={<PageFallback />}>
        <div className="flex-1 min-h-screen min-h-[100dvh] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
          <LocaleSync />
          <ProtectedLayout>
            <Layout>
              <StatsPage />
            </Layout>
          </ProtectedLayout>
        </div>
      </Suspense>
    )
  }
  if (route === 'campaigns') {
    return (
      <Suspense fallback={<PageFallback />}>
        <div className="flex-1 min-h-screen min-h-[100dvh] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
          <LocaleSync />
          <ProtectedLayout adminOnly>
            <Layout>
              <CampaignsPage />
            </Layout>
          </ProtectedLayout>
        </div>
      </Suspense>
    )
  }
  if (route === 'diagnostic') {
    return (
      <Suspense fallback={<PageFallback />}>
        <div className="flex-1 min-h-screen min-h-[100dvh] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
          <LocaleSync />
          <ProtectedLayout adminOnly>
            <Layout>
              <DiagnosticPage />
            </Layout>
          </ProtectedLayout>
        </div>
      </Suspense>
    )
  }

  // Landing page (guest home) — rendue sans le wrapper dark de l'app
  if (route === 'home' && !user) {
    return (
      <Suspense fallback={<PageFallback />}>
        <LocaleSync />
        <div className="scrollbar-cream min-h-[100svh] min-h-[100dvh] min-h-0 w-full overflow-y-auto overflow-x-hidden">
          <LandingPage />
        </div>
      </Suspense>
    )
  }

  const page = protectedPages[route] ?? protectedPages.home

  return (
    <Suspense fallback={<PageFallback />}>
      <div className="flex-1 min-h-screen min-h-[100dvh] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
        <LocaleSync />
        {user && <PushNotificationPriming />}
        {page}
      </div>
    </Suspense>
  )
}

export function AppShell() {
  return <AppRoutes />
}
