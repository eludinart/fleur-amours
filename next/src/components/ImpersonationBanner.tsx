'use client'

import { useState, useEffect } from 'react'
import { t } from '@/i18n'
import { api, isCapacitor } from '@/lib/api-client'

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin').replace(/\/+$/, '').trim() || ''
const AUTH_BEARER_KEY = 'auth_bearer'

function getImpersonationState(): { active: boolean; name: string | null } {
  if (typeof window === 'undefined') return { active: false, name: null }
  const restore = sessionStorage.getItem('impersonate_restore')
  const name = sessionStorage.getItem('impersonating')?.trim() || null
  return { active: !!restore, name }
}

function clearImpersonationMarkers() {
  sessionStorage.removeItem('impersonate_restore')
  sessionStorage.removeItem('impersonating')
  sessionStorage.removeItem('impersonate_admin_user')
}

export function ImpersonationBanner() {
  const [state, setState] = useState(getImpersonationState)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setState(getImpersonationState())
  }, [])

  async function handleDisconnect() {
    if (typeof window === 'undefined' || restoring) return
    const restore = sessionStorage.getItem('impersonate_restore')
    if (!restore) return

    if (restore === 'cookie') {
      setError(t('admin.impersonationRestoreFailed'))
      return
    }

    setRestoring(true)
    setError(null)

    const cachedAdmin = sessionStorage.getItem('impersonate_admin_user')

    if (isCapacitor()) {
      try {
        localStorage.setItem('auth_token', restore)
        if (cachedAdmin) {
          localStorage.setItem('auth_user', cachedAdmin)
        } else {
          const u = (await api.get('/api/auth/me')) as Record<string, unknown>
          localStorage.setItem('auth_user', JSON.stringify(u))
        }
        clearImpersonationMarkers()
        window.location.href = `${BASE}/admin`
      } catch (err) {
        console.error('Impersonation restore failed:', err)
        setError(t('admin.impersonationRestoreFailed'))
        setRestoring(false)
      }
      return
    }

    // Web : Bearer admin prioritaire sur le cookie impersonné (sessionStorage survit au reload)
    sessionStorage.setItem(AUTH_BEARER_KEY, restore)
    if (cachedAdmin) {
      localStorage.setItem('auth_user', cachedAdmin)
    } else {
      localStorage.removeItem('auth_user')
    }
    clearImpersonationMarkers()
    setState({ active: false, name: null })

    try {
      await api.post('/api/auth/admin/impersonate-restore', { backup_token: restore })
    } catch (err) {
      console.warn('Impersonation cookie restore failed (Bearer fallback actif):', err)
    }

    window.location.href = `${BASE}/admin`
  }

  const displayName = state.name ?? t('admin.impersonatingUnknown')
  if (!state.active) return null

  return (
    <div
      className="shrink-0 w-full px-4 py-2.5 flex items-center justify-between gap-3 bg-amber-500 text-amber-950 font-semibold text-sm"
      role="banner"
      aria-live="polite"
    >
      <span className="flex flex-col min-w-0 gap-0.5">
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-base" aria-hidden>👤</span>
          <span className="truncate">
            {t('admin.impersonationBanner', { name: displayName })}
          </span>
        </span>
        {error ? <span className="text-xs font-normal text-amber-900">{error}</span> : null}
      </span>
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={restoring}
        className="shrink-0 px-4 py-1.5 rounded-lg bg-amber-900/90 text-amber-50 hover:bg-amber-900 disabled:opacity-60 font-bold text-xs transition-colors"
      >
        {restoring ? '…' : t('admin.impersonationDisconnect')}
      </button>
    </div>
  )
}
