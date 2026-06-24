'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { LocaleSync } from '@/components/LocaleSync'
import { setLocaleForRequests, isCapacitor } from '@/lib/api-client'
import { useStore } from '@/store/useStore'
import { Layout } from '@/components/layout/Layout'
import { LoginPage } from '@/views/LoginPage'
import { LandingPage } from '@/views/LandingPage'
import { CoachLandingPage } from '@/views/CoachLandingPage'
import { MyceliumLandingPage } from '@/views/MyceliumLandingPage'
import MyceliumAdminPage from '@/views/MyceliumAdminPage'
import MyceliumDashboardPage from '@/views/MyceliumDashboardPage'
import MyceliumEspacePage from '@/views/MyceliumEspacePage'
import MyceliumJoinPage from '@/views/MyceliumJoinPage'
import { MyceliumProtectedLayout } from '@/components/MyceliumProtectedLayout'
import { HomePage } from '@/views/HomePage'
import { PresentationPage } from '@/views/PresentationPage'
import { AccountPage } from '@/views/AccountPage'
import { CoachesDirectoryPage } from '@/views/CoachesDirectoryPage'
import ContactPage from '@/views/ContactPage'
import { ChatPage } from '@/views/ChatPage'
import NotificationsPage from '@/views/NotificationsPage'
import NotificationCampaignPage from '@/views/NotificationCampaignPage'
import NotificationPreferencesPage from '@/views/NotificationPreferencesPage'
import StatsPage from '@/views/StatsPage'
import CampaignsPage from '@/views/CampaignsPage'
import DiagnosticPage from '@/views/DiagnosticPage'
import GraphPage from '@/views/GraphPage'
import SciencePage from '@/views/SciencePage'
import MatrixPage from '@/views/MatrixPage'
import TarotPage from '@/views/TarotPage'
import PaperDrawPage from '@/views/PaperDrawPage'
import SessionPage from '@/views/SessionPage'
import { SessionErrorBoundary } from '@/components/SessionErrorBoundary'
import EclosionTimelinePage from '@/views/EclosionTimelinePage'
import CheckinPage from '@/views/CheckinPage'
import OnboardingDiagnosticPage from '@/views/OnboardingDiagnosticPage'
import ProfileOnboardingPage from '@/views/ProfileOnboardingPage'
import DyadePage from '@/views/DyadePage'
import DuoPage from '@/views/DuoPage'
import ADeuxHubPage from '@/views/a-deux/ADeuxHubPage'
import ADeuxParUnePortePage from '@/views/a-deux/ADeuxParUnePortePage'
import ADeuxCompletPage from '@/views/a-deux/ADeuxCompletPage'
import ADeuxInvitationPage from '@/views/a-deux/ADeuxInvitationPage'
import ADeuxResultPage from '@/views/a-deux/ADeuxResultPage'
import { RouteRedirect } from '@/components/RouteRedirect'
import { DuoLegacyGate } from '@/components/DuoLegacyGate'
import ManuelOnlinePage from '@/views/ManuelOnlinePage'
import DreamscapePage from '@/views/DreamscapePage'
import DreamscapeHistoriquePage from '@/views/DreamscapeHistoriquePage'
import PrairiePage from '@/views/PrairiePage'
import UserLisierePage from '@/views/UserLisierePage'
import ClairierePage from '@/views/ClairierePage'
import MesLiensPage from '@/views/MesLiensPage'
import JardinFilPage from '@/views/JardinFilPage'
import ConstellationsHubPage from '@/views/ConstellationsHubPage'
import ConstellationPage from '@/views/ConstellationPage'
import SalonsPage from '@/views/SalonsPage'
import BoutiquePage from '@/views/BoutiquePage'
import AdminDashboardPage from '@/views/AdminDashboardPage'
import AdminTiragesPage from '@/views/AdminTiragesPage'
import AdminChatPage from '@/views/AdminChatPage'
import AdminPromptsPage from '@/views/AdminPromptsPage'
import AdminPromoPage from '@/views/AdminPromoPage'
import AdminCommsPage from '@/views/admin-comms/AdminCommsPage'
import AdminUsersPage from '@/views/AdminUsersPage'
import AdminSessionsPage from '@/views/AdminSessionsPage'
import AdminSciencePage from '@/views/AdminSciencePage'
import AdminAiPage from '@/views/AdminAiPage'
import AdminTelemetryPage from '@/views/AdminTelemetryPage'
import CoachSuiviPage from '@/views/CoachSuiviPage'
import CoachPatientelePage from '@/views/CoachPatientelePage'
import PushNotificationPriming from '@/components/PushNotificationPriming'
import { ProfileOnboardingGuard } from '@/components/ProfileOnboardingGuard'
import { CommunityOnboardingGuard } from '@/components/social/CommunityOnboardingGuard'
import { MyceliumAccessProvider } from '@/contexts/MyceliumAccessContext'

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
    !!sessionStorage.getItem('auth_bearer') ||
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

function isProtectedMyceliumSubRoute(subRoute?: string): boolean {
  return (
    subRoute === 'admin' ||
    subRoute === 'dashboard' ||
    subRoute === 'climat' ||
    subRoute === 'espace' ||
    subRoute === 'join'
  )
}

function renderMyceliumAppPage(subRoute: string | undefined) {
  const level =
    subRoute === 'join' ? 'join' : subRoute === 'espace' ? 'member' : ('rh' as const)
  const page =
    subRoute === 'admin' ? (
      <MyceliumAdminPage />
    ) : subRoute === 'espace' ? (
      <MyceliumEspacePage />
    ) : subRoute === 'join' ? (
      <MyceliumJoinPage />
    ) : (
      <MyceliumDashboardPage />
    )
  return (
    <ProtectedLayout>
      <Layout>
        <MyceliumProtectedLayout level={level}>{page}</MyceliumProtectedLayout>
      </Layout>
    </ProtectedLayout>
  )
}

function ProtectedLayout({
  children,
  adminOnly = false,
  adminOrCoach = false,
  managerOrRh = false,
}: {
  children: React.ReactNode
  adminOnly?: boolean
  adminOrCoach?: boolean
  managerOrRh?: boolean
}) {
  const { user, loading, isAdmin, isCoach, isManager, isRh } = useAuth()
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
    if (managerOrRh && !isAdmin && !isManager && !isRh) router.replace('/')
  }, [user, loading, isAdmin, isCoach, isManager, isRh, adminOnly, adminOrCoach, managerOrRh, router, pathname])

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
  if (managerOrRh && !isAdmin && !isManager && !isRh) return null

  return (
    <>
      <CommunityOnboardingGuard />
      {children}
    </>
  )
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
            <LandingPage showIndividualSection />
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

  // Page publique : pas d’attente du spinner auth sombre
  const protectedMycelium = route === 'mycelium' && isProtectedMyceliumSubRoute(subRoute)
  if (
    loading &&
    (route === 'accompagnants' ||
      route === 'particuliers' ||
      (route === 'mycelium' && !protectedMycelium))
  ) {
    return (
      <Suspense fallback={null}>
        <LocaleSync />
        <div className="scrollbar-cream min-h-[100svh] min-h-[100dvh] min-h-0 w-full overflow-y-auto overflow-x-hidden">
          {route === 'accompagnants'
            ? <CoachLandingPage />
            : route === 'mycelium'
              ? <MyceliumLandingPage />
              : <LandingPage showAccessSection={false} showIndividualSection />}
        </div>
      </Suspense>
    )
  }

  if (loading) {
    if (protectedMycelium && !routesMounted) {
      return (
        <Suspense fallback={null}>
          <LocaleSync />
          <HomeAuthLoadingShell />
        </Suspense>
      )
    }
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

  /* Pages publiques tirage/partage et dreamscape/partage : app/tirage/partage/[id] et app/dreamscape/partage/[token] */

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
    liens: (
      <ProtectedLayout>
        <Layout>
          <MesLiensPage />
        </Layout>
      </ProtectedLayout>
    ),
    pouls: (
      <ProtectedLayout>
        <Layout>
          <JardinFilPage />
        </Layout>
      </ProtectedLayout>
    ),
    constellations: (
      <ProtectedLayout>
        <Layout>
          <ConstellationsHubPage />
        </Layout>
      </ProtectedLayout>
    ),
    salons: (
      <ProtectedLayout>
        <Layout>
          <SalonsPage />
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
    'tirage-papier': (
      <ProtectedLayout>
        <Layout>
          <PaperDrawPage />
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
            <Suspense fallback={null}>
              <SessionPage />
            </Suspense>
          </SessionErrorBoundary>
        </Layout>
      </ProtectedLayout>
    ),
    fleur: (
      <ProtectedLayout>
        <Layout>
          <RouteRedirect to="/a-deux" />
        </Layout>
      </ProtectedLayout>
    ),
    'fleur-beta': (
      <ProtectedLayout>
        <Layout>
          <RouteRedirect to="/a-deux/par-une-porte" />
        </Layout>
      </ProtectedLayout>
    ),
    'a-deux': (
      <ProtectedLayout>
        <Layout>
          <Suspense fallback={null}>
            <ADeuxHubPage />
          </Suspense>
        </Layout>
      </ProtectedLayout>
    ),
    'mes-duos': (
      <ProtectedLayout>
        <Layout>
          <RouteRedirect to="/a-deux" />
        </Layout>
      </ProtectedLayout>
    ),
    eclosion: (
      <ProtectedLayout>
        <Layout>
          <EclosionTimelinePage />
        </Layout>
      </ProtectedLayout>
    ),
    checkin: (
      <ProtectedLayout>
        <Layout>
          <CheckinPage />
        </Layout>
      </ProtectedLayout>
    ),
    'onboarding-diagnostic': (
      <ProtectedLayout>
        <Layout>
          <OnboardingDiagnosticPage />
        </Layout>
      </ProtectedLayout>
    ),
    'profil-onboarding': (
      <ProtectedLayout>
        <ProfileOnboardingPage />
      </ProtectedLayout>
    ),
    couple: (
      <ProtectedLayout>
        <Layout>
          <Suspense fallback={null}>
            <DyadePage />
          </Suspense>
        </Layout>
      </ProtectedLayout>
    ),
    relation: (
      <ProtectedLayout>
        <Layout>
          <Suspense fallback={null}>
            <DyadePage />
          </Suspense>
        </Layout>
      </ProtectedLayout>
    ),
    duo: (
      <ProtectedLayout>
        <Layout>
          <DuoLegacyGate />
        </Layout>
      </ProtectedLayout>
    ),
    'mes-fleurs': (
      <ProtectedLayout>
        <Layout>
          <RouteRedirect to="/a-deux" />
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
    contact: (
      <ProtectedLayout>
        <Layout>
          <ContactPage />
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
      ) : subRoute === 'campagne' && subRoute2 ? (
        <ProtectedLayout>
          <Layout>
            <NotificationCampaignPage campaignId={subRoute2} />
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
      comms: (
        <ProtectedLayout adminOnly>
          <Layout>
            <Suspense fallback={<PageFallback />}>
              <AdminCommsPage />
            </Suspense>
          </Layout>
        </ProtectedLayout>
      ),
      notifications: (
        <ProtectedLayout adminOnly>
          <Layout>
            <RouteRedirect to="/admin/comms?section=registry" />
          </Layout>
        </ProtectedLayout>
      ),
      broadcasts: (
        <ProtectedLayout adminOnly>
          <Layout>
            <RouteRedirect to="/admin/comms?section=send&channel=notification" />
          </Layout>
        </ProtectedLayout>
      ),
      emails: (
        <ProtectedLayout adminOnly>
          <Layout>
            <RouteRedirect to="/admin/comms?section=send&channel=email" />
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
      ai: (
        <ProtectedLayout adminOnly>
          <Layout>
            <AdminAiPage />
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
    const adminPage = adminPages[adminSubRoute] ?? adminPages['']
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

  // À deux — sous-routes (hub, par une porte, invitation partenaire, synthèse)
  if (route === 'a-deux') {
    const aDeuxSub = subRoute || ''
    const aDeuxPages: Record<string, React.ReactNode> = {
      '': (
        <ProtectedLayout>
          <Layout>
            <Suspense fallback={null}>
              <ADeuxHubPage />
            </Suspense>
          </Layout>
        </ProtectedLayout>
      ),
      'par-une-porte': (
        <ProtectedLayout>
          <Layout>
            <Suspense fallback={null}>
              <ADeuxParUnePortePage />
            </Suspense>
          </Layout>
        </ProtectedLayout>
      ),
      complet: (
        <ProtectedLayout>
          <Layout>
            <ADeuxCompletPage />
          </Layout>
        </ProtectedLayout>
      ),
      invitation: (
        <ProtectedLayout>
          <Layout>
            <Suspense fallback={null}>
              <ADeuxInvitationPage />
            </Suspense>
          </Layout>
        </ProtectedLayout>
      ),
      result: (
        <ProtectedLayout>
          <Layout>
            <Suspense fallback={null}>
              <ADeuxResultPage />
            </Suspense>
          </Layout>
        </ProtectedLayout>
      ),
    }
    const aDeuxPage = aDeuxPages[aDeuxSub] ?? aDeuxPages['']
    if (aDeuxPage) {
      return (
        <Suspense fallback={<PageFallback />}>
          <div className="flex-1 min-h-screen min-h-[100dvh] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
            <LocaleSync />
            {aDeuxPage}
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
          <ProtectedLayout adminOnly>
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

  if (route === 'cartes') {
    return (
      <Suspense fallback={<PageFallback />}>
        <div className="flex-1 min-h-screen min-h-[100dvh] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
          <LocaleSync />
          <ProtectedLayout>
            <Layout>
              <ManuelOnlinePage chapterSlug={subRoute} />
            </Layout>
          </ProtectedLayout>
        </div>
      </Suspense>
    )
  }

  // Page publique accompagnants (coachs, thérapeutes, facilitateurs)
  if (route === 'accompagnants') {
    return (
      <Suspense fallback={<PageFallback />}>
        <LocaleSync />
        <div className="scrollbar-cream min-h-[100svh] min-h-[100dvh] min-h-0 w-full overflow-y-auto overflow-x-hidden">
          <CoachLandingPage />
        </div>
      </Suspense>
    )
  }

  // Page publique entreprise / framework Mycelium
  if (route === 'mycelium' && !isProtectedMyceliumSubRoute(subRoute)) {
    return (
      <Suspense fallback={<PageFallback />}>
        <LocaleSync />
        <div className="scrollbar-cream min-h-[100svh] min-h-[100dvh] min-h-0 w-full overflow-y-auto overflow-x-hidden">
          <MyceliumLandingPage />
        </div>
      </Suspense>
    )
  }

  // Page publique parcours individuel (avec tirage)
  if (route === 'particuliers') {
    return (
      <Suspense fallback={<PageFallback />}>
        <LocaleSync />
        <div className="scrollbar-cream min-h-[100svh] min-h-[100dvh] min-h-0 w-full overflow-y-auto overflow-x-hidden">
          <LandingPage showAccessSection={false} showIndividualSection />
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
          <LandingPage showIndividualSection />
        </div>
      </Suspense>
    )
  }

  const page =
    route === 'constellation' && subRoute
      ? (
        <ProtectedLayout>
          <Layout>
            <ConstellationPage />
          </Layout>
        </ProtectedLayout>
      )
      : route === 'mycelium' && isProtectedMyceliumSubRoute(subRoute)
      ? renderMyceliumAppPage(subRoute)
      : (protectedPages[route] ?? protectedPages.home)

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
  return (
    <ProfileOnboardingGuard>
      <MyceliumAccessProvider>
        <AppRoutes />
      </MyceliumAccessProvider>
    </ProfileOnboardingGuard>
  )
}
