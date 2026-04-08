'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { t } from '@/i18n'
import { DashboardPage } from '@/views/DashboardPage'
import { UserFleurZenHome } from '@/views/UserFleurZenHome'
import CoachDashboardPage from '@/views/CoachDashboardPage'
import AdminDashboardPage from '@/views/AdminDashboardPage'

function ViewSwitcher({
  view,
  showCoachTab,
  isAdmin,
  onSelect,
  isStatsRoute,
}: {
  view: string
  showCoachTab: boolean
  isAdmin: boolean
  onSelect: (v: string) => void
  isStatsRoute?: boolean
}) {
  const homeActive = view === 'user' && !isStatsRoute
  return (
    <div className="shrink-0 flex flex-row flex-nowrap gap-2 mb-4 overflow-x-auto pb-1 scroll-smooth [scrollbar-width:thin]">
      <button
        type="button"
        onClick={() => onSelect('user')}
        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0 ${
          homeActive
            ? 'bg-violet-600 text-white'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        🏡 {t('nav.home') ?? 'Mon Jardin'}
      </button>
      {showCoachTab && (
        <button
          type="button"
          onClick={() => onSelect('coach')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0 ${
            view === 'coach'
              ? 'bg-violet-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          💬 {t('nav.coachDashboard') ?? 'Coach'}
        </button>
      )}
      {isAdmin && (
        <button
          type="button"
          onClick={() => onSelect('admin')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0 ${
            view === 'admin'
              ? 'bg-violet-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          📊 {t('nav.adminDashboard') ?? 'Admin'}
        </button>
      )}
    </div>
  )
}

function HomePageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isAdmin, isCoach } = useAuth()
  const showCoachTab = isCoach || isAdmin
  const viewParam = searchParams?.get?.('view') ?? 'user'
  const isStatsRoute = viewParam === 'stats'
  const view = ['user', 'coach', 'admin'].includes(viewParam)
    ? viewParam
    : isStatsRoute
      ? 'user'
      : isAdmin
        ? 'admin'
        : isCoach
          ? 'coach'
          : 'user'

  const pathname = usePathname()
  const setView = (v: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('view', v)
    const q = params.toString()
    router.replace(q ? `${pathname || '/'}?${q}` : (pathname || '/'))
  }

  // Cas "stats" (DashboardPage a son propre overflow-y-auto)
  if (isStatsRoute) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        {(isCoach || isAdmin) && (
          <ViewSwitcher
            view={view}
            showCoachTab={showCoachTab}
            isAdmin={!!isAdmin}
            onSelect={setView}
            isStatsRoute
          />
        )}
        <DashboardPage />
      </div>
    )
  }

  // Cas "coach" (CoachDashboardPage a son propre overflow-y-auto)
  if (view === 'coach' && showCoachTab) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <ViewSwitcher
          view={view}
          showCoachTab={showCoachTab}
          isAdmin={!!isAdmin}
          onSelect={setView}
          isStatsRoute={false}
        />
        <CoachDashboardPage />
      </div>
    )
  }

  // Cas "admin" (AdminDashboardPage a son propre overflow-y-auto via Layout interne)
  if (view === 'admin' && isAdmin) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <ViewSwitcher view={view} showCoachTab={showCoachTab} isAdmin={isAdmin} onSelect={setView} isStatsRoute={false} />
        <AdminDashboardPage />
      </div>
    )
  }

  // Cas "user" — UserFleurZenHome a son propre overflow-y-auto (comme DashboardPage)
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {(isCoach || isAdmin) && (
        <ViewSwitcher
          view={view}
          showCoachTab={showCoachTab}
          isAdmin={!!isAdmin}
          onSelect={setView}
          isStatsRoute={false}
        />
      )}
      <UserFleurZenHome />
    </div>
  )
}

export function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-950/30 dark:bg-slate-950">
          <span className="w-9 h-9 border-2 border-violet-200/40 border-t-violet-500 rounded-full animate-spin" aria-hidden />
        </div>
      }
    >
      <HomePageInner />
    </Suspense>
  )
}
