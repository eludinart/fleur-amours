'use client'

import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { setLocaleForRequests } from '@/lib/api-client'

export function LocaleSync() {
  const locale = useStore((s) => s.locale)
  useEffect(() => {
    setLocaleForRequests(locale || 'fr')
  }, [locale])
  return null
}
