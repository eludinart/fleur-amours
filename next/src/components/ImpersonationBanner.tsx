'use client'

import { useState, useEffect } from 'react'
import { t } from '@/i18n'
import { api, isCapacitor } from '@/lib/api-client'

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin').replace(/\/+$/, '').trim() || ''

function getImpersonationState(): { active: boolean; name: string | null } {
  if (typeof window === 'undefined') return { active: false, name: null }
  const restore = sessionStorage.getItem('impersonate_restore')
  const name = sessionStorage.getItem('impersonating')?.trim() || null
  return { active: !!restore, name }
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

    setRestoring(true)
    setError(null)
    try {
      if (isCapacitor()) {
        if (restore !== 'cookie') {
          localStorage.setItem('auth_token', restore)
        }
      } else {
        const res = (await api.post('/api/auth/admin/impersonate-restore', {})) as {
          ok?: boolean
          user?: Record<string, unknown>
        }
        if (res?.user) {
          localStorage.setItem('auth_user', JSON.stringify(res.user))
        }
      }

      if (!localStorage.getItem('auth_user')) {
        const u = (await api.get('/api/auth/me')) as Record<string, unknown>
        localStorage.setItem('auth_user', JSON.stringify(u))
      }

      sessionStorage.removeItem('impersonate_restore')
      sessionStorage.removeItem('impersonating')
      window.location.href = `${BASE}/admin`
    } catch (err) {
      console.error('Impersonation restore failed:', err)
      setError(t('admin.impersonationRestoreFailed'))
      setRestoring(false)
    }
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
