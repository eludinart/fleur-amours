'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useStore } from '@/store/useStore'
import { useMyceliumAccess } from '@/hooks/useMyceliumAccess'
import { t } from '@/i18n'
import {
  getAvailableViewModes,
  getNaturalViewMode,
  getViewModeDescriptor,
  isSimulatingLowerRole,
  resolveViewMode,
} from '@/lib/view-modes'

/**
 * Bandeau fin et non bloquant affiché en haut lorsqu'un utilisateur multi-rôles
 * a choisi une vue inférieure à son rôle « naturel » (ex. un admin en vue lambda).
 *
 * Sert de rappel pour ne pas oublier qu'on simule une vue restreinte, avec
 * un lien rapide pour revenir au mode naturel (admin → admin, RH → rh, etc.).
 */
export function LambdaViewBanner() {
  const { user, isAdmin, isCoach, actsAsCoach, isManager, isRh } = useAuth()
  const viewMode = useStore((s) => s.viewMode)
  const setViewMode = useStore((s) => s.setViewMode)
  const { access: myceliumAccess } = useMyceliumAccess(!!user)

  if (!user) return null

  const available = getAvailableViewModes({
    isAdmin,
    isCoach,
    actsAsCoach,
    isManager,
    isRh,
    myceliumAccess: myceliumAccess
      ? {
          showAdmin: myceliumAccess.showAdmin,
          showDashboard: myceliumAccess.showDashboard,
          showEspace: myceliumAccess.showEspace,
        }
      : null,
  })

  const current = resolveViewMode(viewMode, available)
  if (!isSimulatingLowerRole(current, available)) return null

  const natural = getNaturalViewMode({
    isAdmin,
    isCoach,
    actsAsCoach,
    isManager,
    isRh,
    myceliumAccess: myceliumAccess
      ? {
          showAdmin: myceliumAccess.showAdmin,
          showDashboard: myceliumAccess.showDashboard,
          showEspace: myceliumAccess.showEspace,
        }
      : null,
  })
  const currentDesc = getViewModeDescriptor(current)
  const naturalDesc = getViewModeDescriptor(natural)

  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 w-full px-4 py-2 flex items-center justify-between gap-3 bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 text-xs font-medium border-b border-amber-200 dark:border-amber-800/60"
    >
      <span className="flex items-center gap-2 min-w-0">
        <span aria-hidden>{currentDesc.icon}</span>
        <span className="truncate">
          {t('nav.viewModes.simulatingBanner', {
            current: t(currentDesc.labelKey),
          })}
        </span>
      </span>
      <button
        type="button"
        onClick={() => setViewMode(natural)}
        className="shrink-0 inline-flex items-center gap-1 underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-300 font-semibold"
      >
        <span aria-hidden>{naturalDesc.icon}</span>
        <span>
          {t('nav.viewModes.returnTo', { target: t(naturalDesc.labelKey) })}
        </span>
      </button>
    </div>
  )
}
