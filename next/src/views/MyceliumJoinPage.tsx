'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { myceliumApi } from '@/api/mycelium'
import { invalidateMyceliumAccessCache } from '@/hooks/useMyceliumAccess'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

export default function MyceliumJoinPage() {
  useStore((s) => s.locale)
  const router = useRouter()
  const params = useSearchParams()
  const token = params?.get('org_invite') || params?.get('token') || ''
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError(t('mycelium.joinNoToken'))
      return
    }
    let cancelled = false
    myceliumApi
      .accept(token)
      .then(() => {
        invalidateMyceliumAccessCache()
        if (!cancelled) setStatus('ok')
      })
      .catch((e) => {
        if (!cancelled) {
          setStatus('error')
          setError((e as { message?: string })?.message || t('mycelium.error'))
        }
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        {status === 'pending' && (
          <>
            <span className="mx-auto mb-4 block h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" aria-hidden />
            <p className="text-slate-600 dark:text-slate-300">{t('mycelium.joining')}</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{t('mycelium.joined')}</p>
            <button
              type="button"
              onClick={() => router.push('/eclosion')}
              className="mt-4 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              {t('mycelium.joinContinue')}
            </button>
          </>
        )}
        {status === 'error' && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
