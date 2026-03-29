'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from '@/hooks/useToast'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { canUseNativeShare } from '@/utils/share-social'
import { ShareSocialButtons } from './ShareSocialButtons'
import { ogMetaDescriptionFleur, ogMetaTitleFleur } from '@/lib/og-share-copy'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

type ShareFleurButtonProps = {
  targetRef: React.RefObject<HTMLElement | null>
  shareUrl?: string
  filename?: string
  label?: string
}

export function ShareFleurButton({
  targetRef,
  shareUrl,
  filename = 'ma-fleur.png',
  label,
}: ShareFleurButtonProps) {
  useStore((s) => s.locale)
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const base = typeof window !== 'undefined' ? `${window.location.origin}${basePath}`.replace(/\/+$/, '') : ''
  const fullUrl = shareUrl ? base + (shareUrl.startsWith('/') ? shareUrl : `/${shareUrl}`) : typeof window !== 'undefined' ? window.location.href : ''

  // Extract result id from shareUrl (e.g. /fleur?result=42) for OG image
  const resultId = shareUrl?.match(/[?&]result=(\d+)/)?.[1] ?? null
  const ogImageUrl = resultId ? `${base}/api/og/fleur?id=${resultId}` : null

  const sharePayload = {
    url: fullUrl,
    title: ogMetaTitleFleur(),
    text:
      "Ma Fleur d'AmOurs : 8 dimensions de l'amour en un seul visuel. " +
      'Test gratuit, résultat immédiat — venez voir la vôtre sur Fleur d’AmOurs.',
    ...(ogImageUrl ? { image: ogImageUrl } : {}),
  }

  // Inject OG meta tags so the page is social-preview-ready
  useEffect(() => {
    if (!ogImageUrl || typeof window === 'undefined') return
    const desc = ogMetaDescriptionFleur()
    const title = ogMetaTitleFleur()
    const metas: Array<{ attr: string; key: string; content: string }> = [
      { attr: 'property', key: 'og:image', content: ogImageUrl },
      { attr: 'name', key: 'twitter:card', content: 'summary_large_image' },
      { attr: 'name', key: 'twitter:image', content: ogImageUrl },
      { attr: 'property', key: 'og:title', content: title },
      { attr: 'property', key: 'og:description', content: desc },
      { attr: 'name', key: 'twitter:title', content: title },
      { attr: 'name', key: 'twitter:description', content: desc },
    ]
    metas.forEach(({ attr, key, content }) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    })
  }, [ogImageUrl])

  const downloadImage = useCallback(async () => {
    const el = targetRef?.current
    if (!el) {
      toast(t('share.elementNotFound'), 'error')
      return
    }
    setLoading(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = filename
      a.click()
      toast(t('share.imageDownloaded'), 'success')
      setMenuOpen(false)
    } catch {
      toast(t('share.exportError'), 'error')
    } finally {
      setLoading(false)
    }
  }, [targetRef, filename])

  const handleShare = useCallback(async () => {
    // Mobile : priorité au partage natif (ouvre WhatsApp, Twitter, etc.)
    if (canUseNativeShare() && targetRef?.current) {
      try {
        setLoading(true)
        const { default: html2canvas } = await import('html2canvas')
        const canvas = await html2canvas(targetRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
        })
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
        if (blob) {
          const file = new File([blob], filename, { type: 'image/png' })
          await navigator.share({
            title: sharePayload.title,
            text: sharePayload.text,
            url: fullUrl,
            files: [file],
          })
          toast(t('share.shareSuccess'), 'success')
          setMenuOpen(false)
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setMenuOpen(true)
        }
      } finally {
        setLoading(false)
      }
    } else {
      setMenuOpen(true)
    }
  }, [targetRef, filename, fullUrl])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleShare}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/50 hover:border-violet-300 dark:hover:border-violet-700 transition-colors disabled:opacity-60"
      >
        <span>{loading ? '…' : '📤'}</span>
        {label != null && label !== '' && <span>{loading ? '…' : label}</span>}
      </button>
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 min-w-[200px] space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{t('common.share')}</p>
            <ShareSocialButtons payload={sharePayload} onCopyLink={() => setMenuOpen(false)} variant="labels" />
            {targetRef && (
              <button
                type="button"
                onClick={downloadImage}
                disabled={loading || !targetRef?.current}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
              >
                {t('common.downloadImage')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
