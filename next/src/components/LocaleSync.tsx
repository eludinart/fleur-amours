'use client'

import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { setLocaleForRequests } from '@/lib/api-client'
import { api } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'

/** Synchronise la locale UI vers les requêtes API et la persistance serveur. */
export function LocaleSync() {
  const locale = useStore((s) => s.locale)
  const { user } = useAuth()
  const lastSaved = useRef<string | null>(null)

  useEffect(() => {
    setLocaleForRequests(locale || 'fr')
  }, [locale])

  useEffect(() => {
    const loc = locale || 'fr'
    if (!user?.id || lastSaved.current === loc) return
    lastSaved.current = loc
    void api.post('/api/account/profile', { locale: loc }).catch(() => {})
  }, [locale, user?.id])

  return null
}
