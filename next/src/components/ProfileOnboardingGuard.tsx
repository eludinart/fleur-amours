'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { needsProfileOnboarding } from '@/lib/profile-onboarding'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

const ALLOWED_PREFIXES = [
  'profil-onboarding',
  'login',
  'register',
  'account',
  'contact',
  'mycelium',
]

/** Redirige les nouveaux inscrits vers le micro-parcours profil tant qu'il n'est pas complété. */
export function ProfileOnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname() || ''

  useEffect(() => {
    if (loading || !user) return
    const rel = pathname.replace(basePath, '').replace(/^\/+|\/+$/g, '')
    const root = rel.split('/')[0] || ''
    if (ALLOWED_PREFIXES.some((p) => root === p || rel.startsWith(`${p}/`))) return
    if (!needsProfileOnboarding(user)) return
    router.replace('/profil-onboarding')
  }, [user, loading, pathname, router])

  return <>{children}</>
}
