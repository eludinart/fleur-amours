'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/contexts/AuthContext'
import { authApi } from '@/api/auth'
import { t } from '@/i18n'
import { toast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api-client'

/**
 * Modale globale : demande pour devenir accompagnant·e (coach / thérapeute / facilitateur).
 * Ouverture : useStore.getState().openCoachRequestModal() ou <CoachRequestModalTrigger />.
 */
export function CoachRequestModal() {
  const open = useStore((s) => s.coachRequestModalOpen)
  const close = useStore((s) => s.closeCoachRequestModal)
  const { user, refreshUser, isAdmin, isCoach } = useAuth()
  const hasCoachTab = isCoach || isAdmin

  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const loadProfile = useCallback(() => {
    if (!user?.id) return
    setLoadingProfile(true)
    authApi
      .getMyProfile()
      .then((p) => setProfile(p as Record<string, unknown>))
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false))
  }, [user?.id])

  useEffect(() => {
    if (!open || !user?.id || hasCoachTab) return
    loadProfile()
    setMessage('')
  }, [open, user?.id, hasCoachTab, loadProfile])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const res = await authApi.submitCoachRequest({ message: message.trim() || undefined })
      setProfile((res.user ?? null) as Record<string, unknown> | null)
      setMessage('')
      await refreshUser()
      toast(t('account.coachRequestSuccess'), 'success')
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        toast(t('account.coachRequestConflict'), 'error')
        return
      }
      const ex = err as { message?: string; detail?: string }
      toast(ex?.message || ex?.detail || t('account.coachRequestError'), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!mounted || !open) return null
  if (!user || hasCoachTab) return null

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="coach-request-modal-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label={t('account.coachRequestModalClose')}
        onClick={close}
      />
      <div className="relative z-[1] w-full max-w-lg max-h-[min(92dvh,720px)] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-violet-200/80 dark:border-violet-800/60 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="sticky top-0 z-[2] flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-4 py-3 backdrop-blur-sm">
          <h2 id="coach-request-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100 pr-2">
            {t('account.coachRequestTitle')}
          </h2>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {t('account.coachRequestModalClose')}
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <p className="text-xs font-medium text-violet-700 dark:text-violet-300">{t('account.coachRequestSubtitle')}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{t('account.coachRequestIntro')}</p>
          <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed border-l-2 border-violet-300 dark:border-violet-700 pl-3">
            {t('account.coachRequestRoadmap')}
          </p>
          <Link
            href="/accompagnants"
            onClick={close}
            className="inline-block text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline"
          >
            {t('account.coachRequestLearnMore')} →
          </Link>

          {loadingProfile ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">…</p>
          ) : profile?.coach_request_status === 'pending' ? (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/25 px-4 py-3">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{t('account.coachRequestPending')}</p>
              {profile?.coach_request_at ? (
                <p className="text-xs text-amber-800/80 dark:text-amber-200/70 mt-1">
                  {t('account.coachRequestPendingAt').replace(
                    '{date}',
                    new Date(String(profile.coach_request_at)).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  )}
                </p>
              ) : null}
              {profile?.coach_request_message ? (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 whitespace-pre-wrap">{String(profile.coach_request_message)}</p>
              ) : null}
            </div>
          ) : (
            <>
              {profile?.coach_request_status === 'rejected' ? (
                <p className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-900/50 rounded-xl px-4 py-3">
                  {t('account.coachRequestRejected')}
                </p>
              ) : null}
              <form onSubmit={handleSubmit} className="space-y-3 pt-1">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('account.coachRequestMessageLabel')}</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                    rows={4}
                    placeholder={t('account.coachRequestMessagePlaceholder')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 resize-y min-h-[5rem]"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t('account.coachRequestMessageHint')}</p>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  {busy ? '…' : t('account.coachRequestSubmit')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

/** Bouton qui ouvre la modale ; ne s’affiche pas pour coach/admin. */
export function CoachRequestModalTrigger({
  className = '',
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  const open = useStore((s) => s.openCoachRequestModal)
  const { user, isAdmin, isCoach } = useAuth()
  if (!user || isCoach || isAdmin) return null
  return (
    <button type="button" onClick={open} className={className}>
      {children ?? t('account.coachRequestTrigger')}
    </button>
  )
}
