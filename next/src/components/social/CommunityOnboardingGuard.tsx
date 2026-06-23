// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { CommunityOnboardingModal } from '@/components/social/CommunityOnboardingModal'

const COMMUNITY_ROUTE_PREFIXES = ['/prairie', '/liens', '/clairiere', '/lisiere', '/pouls']

/**
 * Guard discret : ouvre la modale d'onboarding communautaire (A5) la première
 * fois qu'un utilisateur entre sur une route communautaire sans avoir terminé
 * l'onboarding (`user.community_onboarding_done !== true`).
 *
 * Pas d'appel réseau supplémentaire : on s'appuie sur les meta exposés via /api/auth/me.
 */
export function CommunityOnboardingGuard() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [seenInSession, setSeenInSession] = useState(false)

  useEffect(() => {
    if (!user || seenInSession || open) return
    const u = user as Record<string, unknown>
    if (u.community_onboarding_done === true) return

    const path = (pathname || '').replace(/^\/jardin/, '') || '/'
    const isCommunityRoute = COMMUNITY_ROUTE_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))
    if (!isCommunityRoute) return

    setOpen(true)
  }, [user, pathname, seenInSession, open])

  if (!open) return null

  return (
    <CommunityOnboardingModal
      onClose={() => {
        setOpen(false)
        setSeenInSession(true)
      }}
    />
  )
}
