'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '@/hooks/useToast'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { useResolvedShareUrl } from '@/hooks/useResolvedShareUrl'
import { shouldOfferNativeShare } from '@/utils/share-social'
import { dreamscapeApi } from '@/api/dreamscape'
import { ShareSocialButtons } from './ShareSocialButtons'
import { ogMetaDescriptionDreamscape, ogMetaTitleDreamscape } from '@/lib/og-share-copy'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function buildDreamscapeShareText(
  poeticReflection: string | null | undefined,
  shareTextOverride: string | null | undefined
): string {
  if (shareTextOverride?.trim()) return shareTextOverride.trim()
  if (poeticReflection?.trim()) {
    const p = poeticReflection.trim()
    const poeticSnippet = ` « ${p.slice(0, 80)}${p.length > 80 ? '…' : ''} »`
    return `J'ai traversé les cartes oniriques de Fleur d'AmOurs.${poeticSnippet} 🌸`
  }
  return t('share.dreamscapeShareText')
}

export type ShareDreamscapeButtonProps = {
  savedId: number
  /** Déjà obtenu (ex. POST /share après sauvegarde) — évite un appel réseau au premier clic */
  initialShareToken?: string | null
  poeticReflection?: string | null
  /** Remplace le texte généré depuis poeticReflection */
  shareTextOverride?: string | null
  showLabel?: boolean
  showEncouragement?: boolean
  /** `onDark` : bouton lisible sur fond sombre (modale fin de promenade) */
  appearance?: 'default' | 'onDark'
  menuAlign?: 'left' | 'right'
  className?: string
}

export function ShareDreamscapeButton({
  savedId,
  initialShareToken = null,
  poeticReflection = null,
  shareTextOverride = null,
  showLabel = true,
  showEncouragement = false,
  appearance = 'default',
  menuAlign = 'right',
  className = '',
}: ShareDreamscapeButtonProps) {
  useStore((s) => s.locale)
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken ?? null)

  useEffect(() => {
    setShareToken(initialShareToken ?? null)
  }, [initialShareToken])

  const publicPageUrl = useResolvedShareUrl(shareToken ? `/dreamscape/partage/${shareToken}` : false)

  const shareText = useMemo(
    () => buildDreamscapeShareText(poeticReflection, shareTextOverride),
    [poeticReflection, shareTextOverride]
  )

  const title = ogMetaTitleDreamscape()

  /** Fallback immédiat si le hook n’a pas encore résolu l’URL absolue (menu juste après création du token). */
  const absoluteShareUrl = useMemo(() => {
    if (publicPageUrl) return publicPageUrl
    if (!shareToken || typeof window === 'undefined') return ''
    const origin = window.location.origin
    const bp = basePath.startsWith('/') ? basePath : `/${basePath}`
    return `${origin}${bp.replace(/\/+$/, '')}/dreamscape/partage/${shareToken}`
  }, [publicPageUrl, shareToken])

  const sharePayload = useMemo(
    () => ({
      url: absoluteShareUrl,
      title,
      text: shareText,
    }),
    [absoluteShareUrl, title, shareText]
  )

  useEffect(() => {
    if (!shareToken || typeof window === 'undefined') return
    const bp = basePath.startsWith('/') ? basePath : `/${basePath}`
    const ogImgUrl = `${window.location.origin}${bp}/api/og/dreamscape?token=${encodeURIComponent(shareToken)}`
    const desc = ogMetaDescriptionDreamscape(poeticReflection)
    const metas: Array<{ attr: string; key: string; content: string }> = [
      { attr: 'property', key: 'og:image', content: ogImgUrl },
      { attr: 'property', key: 'og:title', content: title },
      { attr: 'property', key: 'og:description', content: desc },
      { attr: 'name', key: 'twitter:card', content: 'summary_large_image' },
      { attr: 'name', key: 'twitter:image', content: ogImgUrl },
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
  }, [shareToken, poeticReflection, title])

  const ensureToken = useCallback(async (): Promise<string> => {
    if (shareToken) return shareToken
    const res = (await dreamscapeApi.share(String(savedId))) as {
      shareToken?: string
      shareUrl?: string
    }
    const raw = res?.shareToken || res?.shareUrl?.match(/partage\/([^/?#]+)/)?.[1]
    if (!raw) throw new Error(t('share.dreamscapeShareError'))
    setShareToken(raw)
    return raw
  }, [savedId, shareToken])

  const handleShare = useCallback(async () => {
    setBusy(true)
    try {
      const tok = await ensureToken()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const bp = basePath.startsWith('/') ? basePath : `/${basePath}`
      const url = `${origin}${bp.replace(/\/+$/, '')}/dreamscape/partage/${tok}`
      const payload = { title, text: shareText, url }
      const textWithUrl =
        payload.text.includes(payload.url) ? payload.text : `${payload.text}\n\n${payload.url}`

      if (shouldOfferNativeShare()) {
        try {
          await navigator.share({
            title: payload.title,
            text: textWithUrl,
            url: payload.url,
          })
          toast(t('share.shareSuccess'), 'success')
        } catch (e) {
          if ((e as Error).name !== 'AbortError') {
            setMenuOpen(true)
          }
        }
      } else {
        setMenuOpen(true)
      }
    } catch (e) {
      toast((e as Error)?.message || t('share.dreamscapeShareError'), 'error')
    } finally {
      setBusy(false)
    }
  }, [ensureToken, title, shareText])

  const shareTitle = showEncouragement ? t('share.encourageDreamscapeTitle') : t('common.share')

  const btnClass =
    appearance === 'onDark'
      ? 'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap border border-white/30 bg-white/10 text-white/90 hover:bg-white/20 transition-colors'
      : 'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/50 hover:border-violet-300 dark:hover:border-violet-700 transition-colors'

  const menuPos = menuAlign === 'left' ? 'left-0' : 'right-0'

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`.trim()}>
      <div className="relative">
        <button
          type="button"
          onClick={handleShare}
          disabled={busy}
          className={btnClass}
          title={shareTitle}
          aria-label={shareTitle}
        >
          <span>{busy ? '…' : '📤'}</span>
          {showLabel && <span>{busy ? '…' : t('common.share')}</span>}
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div
              className={`absolute ${menuPos} top-full mt-1 z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 min-w-[200px]`}
            >
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{t('common.share')}</p>
              {absoluteShareUrl ? (
                <ShareSocialButtons
                  payload={sharePayload}
                  onCopyLink={() => setMenuOpen(false)}
                  variant="labels"
                  encourageLine={t('share.encourageDreamscapeMenu')}
                  encourageOnDark={false}
                />
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300 py-2">{t('share.linkPreparing')}</p>
              )}
            </div>
          </>
        )}
      </div>
      {showEncouragement && shareToken && absoluteShareUrl ? (
        <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 max-w-[20rem] leading-snug px-1">
          {t('share.encourageDreamscape')}
        </p>
      ) : null}
    </div>
  )
}
