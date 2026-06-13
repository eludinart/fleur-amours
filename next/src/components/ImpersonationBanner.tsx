'use client'

import { useState, useEffect } from 'react'
import { t } from '@/i18n'
import { api, getResolvedApiBase, isCapacitor } from '@/lib/api-client'

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin').replace(/\/+$/, '').trim() || ''

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)

    if (url.searchParams.get('impersonation_restored') === '1') {
      const cachedAdmin = sessionStorage.getItem('impersonate_admin_user')
      if (cachedAdmin) {
        try {
          localStorage.setItem('auth_user', cachedAdmin)
        } catch {
          /* ignore */
        }
      }
      clearImpersonationMarkers()
      url.searchParams.delete('impersonation_restored')
      const qs = url.searchParams.toString()
      window.history.replaceState({}, '', url.pathname + (qs ? `?${qs}` : ''))
      setState({ active: false, name: null })
    }

    if (url.searchParams.get('impersonation_restore_error') === '1') {
      setError(t('admin.impersonationRestoreFailed'))
      url.searchParams.delete('impersonation_restore_error')
      const qs = url.searchParams.toString()
      window.history.replaceState({}, '', url.pathname + (qs ? `?${qs}` : ''))
    }
  }, [])

  async function handleDisconnect() {
    if (typeof window === 'undefined' || restoring) return
    const restore = sessionStorage.getItem('impersonate_restore')
    if (!restore) return

    setRestoring(true)
    setError(null)
    localStorage.removeItem('auth_user')

    if (isCapacitor()) {
      try {
        localStorage.setItem('auth_token', restore)
        const cachedAdmin = sessionStorage.getItem('impersonate_admin_user')
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

    const apiBase = getResolvedApiBase()

    // JWT admin stocké côté client → POST formulaire (navigation complète, Set-Cookie fiable)
    if (restore !== 'cookie') {
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = `${apiBase}/api/auth/admin/impersonate-restore`
      form.enctype = 'application/x-www-form-urlencoded'
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = 'backup_token'
      input.value = restore
      form.appendChild(input)
      document.body.appendChild(form)
      form.submit()
      return
    }

    // Ancienne session (sentinelle « cookie ») → GET avec cookie backup httpOnly
    window.location.href = `${apiBase}/api/auth/admin/impersonate-restore?redirect=1`
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
