// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { fleurApi } from '@/api/fleur'
import { fleurBetaApi } from '@/api/fleur-beta'
import { ContextualHint } from '@/components/ContextualHint'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

function formatDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MesFleursPage() {
  useStore((s) => s.locale)
  const router = useRouter()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function loadResults() {
    setError('')
    setLoading(true)
    fleurApi.getMyResults()
      .then(data => setItems(data.items || []))
      .catch((e) => {
        const status = e?.status ?? e?.response?.status
        const msg = e?.message || e?.detail
        if (status === 401) setError(t('errors.sessionExpired'))
        else if (status === 404 || status === 501) setError(t('errors.unavailable'))
        else setError(msg || t('mesFleurs.loadError'))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadResults() }, [])

  function openItem(item) {
    if (item.type === 'duo') {
      router.push(`/duo?token=${encodeURIComponent(item.token)}`)
    } else if (item.type === 'fleur-beta') {
      router.push(`/fleur-beta?result=${item.id}`)
    } else {
      router.push(`/fleur?result=${item.id}`)
    }
  }

  async function deleteItem(e, item) {
    e.stopPropagation()
    const label =
      item.type === 'duo'
        ? t('mesFleurs.thisDuo')
        : item.type === 'fleur-beta'
          ? t('mesFleurs.thisFleurBeta')
          : t('mesFleurs.thisFleur')
    if (!window.confirm(t('mesFleurs.deleteConfirm', { label }))) return
    setError('')
    try {
      if (item.type === 'fleur-beta') {
        await fleurBetaApi.delete(Number(item.id))
      } else {
        await fleurApi.deleteResult(item)
      }
      loadResults()
    } catch (e) {
      const msg = e?.message ?? e?.response?.data?.detail ?? e?.detail ?? t('mesFleurs.deleteError')
      setError(msg)
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-16 flex flex-col items-center justify-center">
        <span className="w-10 h-10 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
        <p className="mt-4 text-slate-500">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-6 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold">{t('mesFleurs.title')}</h1>
        <p className="text-sm text-slate-500">
          {t('mesFleurs.subtitle')}
        </p>
        <div className="mt-4 text-left max-w-md mx-auto">
          <ContextualHint hintId="ctx_mes_fleurs" messageKey="onboarding.contextual.mesFleurs" />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400 space-y-2">
          <p>{error}</p>
          <button
            onClick={loadResults}
            className="text-sm font-medium underline hover:no-underline"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {items.length === 0 && !error && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">{t('mesFleurs.empty')}</p>
          <p className="text-sm text-slate-500 mt-1">{t('mesFleurs.emptyDesc')}</p>
          <div className="flex gap-3 justify-center mt-4">
            <Link href="/fleur" className="px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-hover">
              {t('nav.fleur')}
            </Link>
            <Link href="/fleur-beta" className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:opacity-90">
              {t('nav.fleurBeta')}
            </Link>
            <Link href="/duo" className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-xl text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600">
              {t('nav.duo')}
            </Link>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div id="section-fleurs" className="space-y-3">
          {items.map((item) => (
            <div
              key={`${item.type}-${item.id}-${item.created_at}`}
              onClick={() => openItem(item)}
              className={`w-full text-left rounded-2xl border p-4 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                item.type === 'duo'
                  ? 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                  : item.type === 'fleur-beta'
                    ? 'border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/20 hover:border-violet-300 dark:hover:border-violet-700'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-accent/40 hover:bg-accent/5 dark:hover:bg-accent/10'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-2xl shrink-0">
                  {item.type === 'duo' ? '💞' : item.type === 'fleur-beta' ? '🧪' : '🌸'}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    {item.type === 'duo'
                      ? t('mesFleurs.fleurDuo')
                      : item.type === 'fleur-beta'
                        ? t('nav.fleurBeta')
                        : t('nav.fleur')}
                    {item.type === 'fleur-beta' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-violet-200/80 dark:bg-violet-800/80 text-violet-800 dark:text-violet-100">
                        Beta
                      </span>
                    )}
                    {item.type === 'duo' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-rose-200/80 dark:bg-rose-800/80 text-rose-700 dark:text-rose-200">
                        {t('mesFleurs.duo')}
                      </span>
                    )}
                  </p>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <p>{formatDate(item.created_at)}</p>
                    {item.type === 'duo' && item.status === 'complete' && (
                      <p className="text-emerald-600 dark:text-emerald-400">{t('mesFleurs.complete')}</p>
                    )}
                    {item.type === 'duo' && item.status !== 'complete' && (
                      <p className="italic text-slate-400">
                        {item.invited_email
                          ? t('mesFleurs.waitingFor', { email: item.invited_email })
                          : t('mesFleurs.waiting')}
                      </p>
                    )}
                    {item.type === 'duo' && item.status === 'complete' && item.partner_email && (
                      <p className="text-slate-400 truncate max-w-[200px]" title={item.partner_email}>
                        {t('mesFleurs.with')} {item.partner_email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => deleteItem(e, item)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                  title={t('common.delete')}
                  aria-label={t('common.delete')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <span className="text-slate-400">→</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
