'use client'

import { useState, useEffect } from 'react'
import { t } from '@/i18n'

export function NetworkStatusBanner() {
  const [online, setOnline] = useState(true)
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setOnline(navigator.onLine)
    const timers: ReturnType<typeof setTimeout>[] = []

    function handleOnline() {
      setOnline(true)
      setShowReconnected(true)
      const id = setTimeout(() => setShowReconnected(false), 3000)
      timers.push(id)
    }

    function handleOffline() {
      setOnline(false)
      setShowReconnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      timers.forEach(clearTimeout)
    }
  }, [])

  if (online && !showReconnected) return null

  if (!online) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[9999] px-4 py-2 text-center text-sm font-medium bg-amber-600 text-white shadow-lg"
        role="status"
        aria-live="polite"
      >
        {t('common.offline')}
      </div>
    )
  }

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white shadow-lg transition-opacity duration-300"
      role="status"
      aria-live="polite"
    >
      {t('common.onlineRestored')}
    </div>
  )
}
