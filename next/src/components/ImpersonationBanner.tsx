'use client'

import { useState, useEffect } from 'react'
import { t } from '@/i18n'
import { api } from '@/lib/api-client'

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin').replace(/\/+$/, '').trim() || ''

function getImpersonationState(): { active: boolean; name: string | null } {
  if (typeof window === 'undefined') return { active: false, name: null }
  const restore = sessionStorage.getItem('impersonate_restore')
  const name = sessionStorage.getItem('impersonating')?.trim() || null
  return { active: !!restore, name }
}

export function ImpersonationBanner() {
  const [state, setState] = useState(getImpersonationState)

  useEffect(() => {
    setState(getImpersonationState())
  }, [])

  async function handleDisconnect() {
    if (typeof window === 'undefined') return
    const restore = sessionStorage.getItem('impersonate_restore')
    if (!restore) return
    try {
      // Web: restaure le cookie httpOnly admin
      await api.post('/api/auth/admin/impersonate-restore', {})
    } catch {
      // ignore
    } finally {
      // Capacitor: restaure le Bearer token (si présent)
      if (restore) localStorage.setItem('auth_token', restore)
      sessionStorage.removeItem('impersonate_restore')
      sessionStorage.removeItem('impersonating')
      window.location.href = `${BASE}/admin` || '/admin'
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
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-base" aria-hidden>👤</span>
        <span className="truncate">
          {t('admin.impersonationBanner', { name: displayName })}
        </span>
      </span>
      <button
        type="button"
        onClick={handleDisconnect}
        className="shrink-0 px-4 py-1.5 rounded-lg bg-amber-900/90 text-amber-50 hover:bg-amber-900 font-bold text-xs transition-colors"
      >
        {t('admin.impersonationDisconnect')}
      </button>
    </div>
  )
}
