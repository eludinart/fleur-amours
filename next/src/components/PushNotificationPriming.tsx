'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import { t } from '@/i18n'
import {
  registerPushTokenForUser,
  pushTokenStorageKey,
  isWebPushConfigured,
} from '@/lib/push-notifications-client'

/**
 * Avant la demande native du navigateur, explique pourquoi accepter les notifications.
 */
export default function PushNotificationPriming() {
  const { user } = useAuth()
  const userId = user?.id ? Number(user.id) : null
  const [open, setOpen] = useState(false)

  const evaluateOpen = useCallback(() => {
    if (!userId || typeof window === 'undefined') return
    if (!isWebPushConfigured()) return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'default') return
    if (localStorage.getItem(pushTokenStorageKey(userId)) === '1') return

    const loginKey = `push_just_logged_in_${userId}`
    const justLoggedIn = sessionStorage.getItem(loginKey) === '1'
    if (justLoggedIn) {
      sessionStorage.removeItem(loginKey)
      setOpen(true)
      return
    }
    if (sessionStorage.getItem('push_permission_priming_dismissed') === '1') return
    setOpen(true)
  }, [userId])

  useEffect(() => {
    evaluateOpen()
  }, [evaluateOpen])

  const onAccept = async () => {
    if (!userId) {
      setOpen(false)
      return
    }
    setOpen(false)
    await registerPushTokenForUser(userId)
  }

  const onLater = () => {
    sessionStorage.setItem('push_permission_priming_dismissed', '1')
    setOpen(false)
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-priming-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl shrink-0" aria-hidden>
            🔔
          </span>
          <div className="min-w-0">
            <h2 id="push-priming-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t('layout.pushPrimingTitle')}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('layout.pushPrimingBody')}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-500">{t('layout.pushPrimingHint')}</p>
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
          <button
            type="button"
            onClick={onLater}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t('layout.pushPrimingLater')}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500 transition-colors shadow-lg shadow-violet-500/25"
          >
            {t('layout.pushPrimingContinue')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
