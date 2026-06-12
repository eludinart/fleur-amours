'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '@/i18n'
import { isCapacitor } from '@/lib/api-client'
import {
  dismissInstallBanner,
  isIosSafari,
  isStandaloneDisplay,
  wasInstallBannerDismissed,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa-install'

/**
 * Invite à installer l’app sur l’écran d’accueil :
 * - Android Chrome : bouton via beforeinstallprompt
 * - iOS Safari : instructions « Partager → Sur l’écran d’accueil »
 */
export default function InstallPwaBanner() {
  const [visible, setVisible] = useState(false)
  const [iosGuide, setIosGuide] = useState(false)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)

  const evaluate = useCallback(() => {
    if (typeof window === 'undefined') return
    if (isCapacitor() || isStandaloneDisplay() || wasInstallBannerDismissed()) {
      setVisible(false)
      return
    }
    if (deferredPromptRef.current) {
      setVisible(true)
      setIosGuide(false)
      return
    }
    if (isIosSafari()) {
      setVisible(true)
      setIosGuide(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isCapacitor() || isStandaloneDisplay() || wasInstallBannerDismissed()) return

    const onBip = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent
      setIosGuide(false)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', onBip)
    evaluate()

    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [evaluate])

  const onInstallAndroid = async () => {
    const ev = deferredPromptRef.current
    if (!ev) return
    try {
      await ev.prompt()
      await ev.userChoice
    } catch {
      /* ignore */
    }
    deferredPromptRef.current = null
    setVisible(false)
  }

  const onDismiss = () => {
    dismissInstallBanner()
    setVisible(false)
  }

  if (!visible) return null

  return createPortal(
    <div
      className="fixed bottom-0 left-0 right-0 z-[9998] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
      role="region"
      aria-label={t('pwaInstall.bannerAria')}
    >
      <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border border-violet-200/80 bg-white/95 dark:bg-slate-900/95 shadow-xl backdrop-blur-md p-4 dark:border-violet-900/60">
        <div className="flex items-start gap-3">
          <img
            src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'}/juste-la-fleur.png`}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl object-contain"
            width={48}
            height={48}
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {t('pwaInstall.title')}
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {iosGuide ? t('pwaInstall.iosLead') : t('pwaInstall.androidLead')}
            </p>
            {iosGuide && (
              <ol className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-300 list-decimal list-inside">
                <li>{t('pwaInstall.iosStep1')}</li>
                <li>{t('pwaInstall.iosStep2')}</li>
                <li>{t('pwaInstall.iosStep3')}</li>
              </ol>
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none p-1"
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          {!iosGuide && deferredPromptRef.current && (
            <button
              type="button"
              onClick={onInstallAndroid}
              className="flex-1 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition"
            >
              {t('pwaInstall.installCta')}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className={`rounded-full border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition ${
              iosGuide || !deferredPromptRef.current ? 'flex-1' : ''
            }`}
          >
            {t('pwaInstall.later')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
