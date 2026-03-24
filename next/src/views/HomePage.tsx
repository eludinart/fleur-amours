'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { t } from '@/i18n'
import { DashboardPage } from '@/views/DashboardPage'
import CoachDashboardPage from '@/views/CoachDashboardPage'
import AdminDashboardPage from '@/views/AdminDashboardPage'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function ViewSwitcher({
  view,
  isCoach,
  isAdmin,
  onSelect,
}: {
  view: string
  isCoach: boolean
  isAdmin: boolean
  onSelect: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        type="button"
        onClick={() => onSelect('user')}
        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
          view === 'user'
            ? 'bg-violet-600 text-white'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        🏡 {t('nav.home') ?? 'Mon Jardin'}
      </button>
      {isCoach && (
        <button
          type="button"
          onClick={() => onSelect('coach')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
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
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
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

export function HomePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isAdmin, isCoach } = useAuth()
  const viewParam = searchParams?.get?.('view') ?? 'user'
  const view = ['user', 'coach', 'admin'].includes(viewParam)
    ? viewParam
    : (isAdmin ? 'admin' : isCoach ? 'coach' : 'user')

  const pathname = usePathname()
  const setView = (v: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('view', v)
    const q = params.toString()
    router.replace(q ? `${pathname || '/'}?${q}` : (pathname || '/'))
  }

  if (view === 'coach' && isCoach) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <ViewSwitcher view={view} isCoach={isCoach} isAdmin={!!isAdmin} onSelect={setView} />
        <CoachDashboardPage />
      </div>
    )
  }
  if (view === 'admin' && isAdmin) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <ViewSwitcher view={view} isCoach={!!isCoach} isAdmin={isAdmin} onSelect={setView} />
        <AdminDashboardPage />
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {(isCoach || isAdmin) && (
        <ViewSwitcher view={view} isCoach={!!isCoach} isAdmin={!!isAdmin} onSelect={setView} />
      )}
      <DashboardPage />
    </div>
  )
}

