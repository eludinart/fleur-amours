'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useMyceliumAccess } from '@/hooks/useMyceliumAccess'
import { t } from '@/i18n'

type Level = 'member' | 'rh' | 'join'

function canAccessLevel(
  level: Level,
  flags: { isAdmin: boolean; showDashboard: boolean; showEspace: boolean; isAppAdmin: boolean }
): boolean {
  if (level === 'join') return true
  if (flags.isAdmin || flags.isAppAdmin) return true
  if (level === 'member') return flags.showEspace
  return flags.showDashboard
}

/** Garde le contenu Mycelium — ne bloque pas la sidebar ni la navigation. */
export function MyceliumProtectedLayout({
  children,
  level,
}: {
  children: React.ReactNode
  level: Level
}) {
  const { user, loading: authLoading, isAdmin } = useAuth()
  const { access, loading: accessLoading } = useMyceliumAccess(level !== 'join' && !!user)

  const flags = {
    isAdmin,
    isAppAdmin: access?.isAppAdmin ?? false,
    showDashboard: access?.showDashboard ?? false,
    showEspace: access?.showEspace ?? false,
  }
  const accessReady = level === 'join' || !user || isAdmin || !accessLoading
  const allowed = canAccessLevel(level, flags)

  if (authLoading || !user) {
    return <MyceliumContentFallback />
  }
  if (!accessReady) {
    return <MyceliumContentFallback />
  }
  if (level !== 'join' && !allowed) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50/80 p-8 text-center dark:border-amber-900 dark:bg-amber-950/20">
        <p className="text-slate-800 dark:text-slate-200">{t('mycelium.accessDenied')}</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {t('mycelium.backHome')}
        </Link>
      </div>
    )
  }

  return <>{children}</>
}

function MyceliumContentFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600"
        aria-hidden
      />
    </div>
  )
}
