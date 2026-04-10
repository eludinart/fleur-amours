'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from '@/hooks/useToast'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { useResolvedShareUrl } from '@/hooks/useResolvedShareUrl'
import { canUseNativeShare } from '@/utils/share-social'
import { ShareSocialButtons } from './ShareSocialButtons'
import { ogMetaDescriptionTirage, ogMetaTitleTirage } from '@/lib/og-share-copy'
import { getTirageShareableId } from '@/lib/tirage-share-id'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function formatDate(iso: string | undefined): string {
  try {
    return new Date(iso || '').toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

function buildShareText(r: {
  type?: string
  card?: { name?: string; synth?: string }
  cards?: Array<{ name?: string }>
  intention?: string
  createdAt?: string
}): string {
  if (!r) return t('share.tirageShareText')

  const typeLabel = r.type === 'simple' ? t('tarot.simple') : t('tarot.fourDoors')

  if (r.type === 'simple' && r.card?.name) {
    const cardLine = r.card.name
    const synthSnippet = r.card.synth ? ` — « ${r.card.synth.slice(0, 80)}${r.card.synth.length > 80 ? '…' : ''} »` : ''
    return `J'ai tiré ${cardLine}${synthSnippet}\n\nTirage ${typeLabel} — Fleur d'AmOurs 🌸`
  }

  if (r.type === 'four' && r.cards?.length) {
    const names = r.cards.map((c) => c.name).join(' · ')
    return `Mon tirage 4 Portes : ${names}\n\nFleur d'AmOurs 🌸`
  }

  return t('share.tirageShareText')
}

type ShareTirageButtonProps = {
  reading?: {
    id?: string
    type?: string
    card?: { name?: string; synth?: string }
    cards?: Array<{ name?: string }>
    intention?: string
    createdAt?: string
    synthesis?: string
  }
  showLabel?: boolean
  /** Texte d’accroche sous le bouton (écran résultat), pas dans la liste */
  showEncouragement?: boolean
}

export function ShareTirageButton({
  reading,
  showLabel = true,
  showEncouragement = false,
}: ShareTirageButtonProps) {
  useStore((s) => s.locale)
  const [menuOpen, setMenuOpen] = useState(false)

  const shareId = getTirageShareableId(reading as Record<string, unknown> | undefined)
  const publicPageUrl = useResolvedShareUrl(shareId ? `/tirage/partage/${shareId}` : false)

  const text = buildShareText(reading || {})

  const sharePayload = {
    url: publicPageUrl,
    title: "Mon tirage Fleur d'AmOurs",
    text,
  }

  // Inject OG meta for current page when a reading is open
  useEffect(() => {
    if (!shareId || typeof window === 'undefined') return
    const ogImgUrl = `${window.location.origin}${basePath}/api/og/tirage?id=${shareId}`
    const cardName =
      reading?.type === 'simple'
        ? (reading.card?.name || '')
        : (reading?.cards?.map((c) => c.name).join(' · ') || '')
    const synthSnippet =
      reading?.type === 'simple' ? (reading.card?.synth ?? null) : (reading?.synthesis ?? null)
    const title = ogMetaTitleTirage(cardName)
    const desc = ogMetaDescriptionTirage(cardName || 'tarot', synthSnippet)
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
  }, [reading, shareId])

  const handleShare = useCallback(async () => {
    if (!publicPageUrl) {
      setMenuOpen(true)
      return
    }
    if (canUseNativeShare()) {
      try {
        await navigator.share({
          title: sharePayload.title,
          text: sharePayload.text,
          url: publicPageUrl,
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
  }, [publicPageUrl, text])

  const shareTitle = showEncouragement ? t('share.encourageTirageTitle') : t('common.share')

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
      <button
        type="button"
        onClick={handleShare}
        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/50 hover:border-violet-300 dark:hover:border-violet-700 transition-colors`}
        title={shareTitle}
        aria-label={shareTitle}
      >
        <span>📤</span>
        {showLabel && <span>{t('common.share')}</span>}
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 min-w-[200px]">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{t('common.share')}</p>
            {publicPageUrl ? (
              <ShareSocialButtons
                payload={sharePayload}
                onCopyLink={() => setMenuOpen(false)}
                variant="labels"
                encourageLine={t('share.encourageTirageMenu')}
              />
            ) : reading && !shareId ? (
              <p className="text-sm text-amber-800 dark:text-amber-200 py-2 leading-snug">
                {t('share.tirageNeedsServerId')}
              </p>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300 py-2">{t('share.linkPreparing')}</p>
            )}
          </div>
        </>
      )}
      </div>
      {showEncouragement && shareId && publicPageUrl ? (
        <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 max-w-[20rem] leading-snug px-1">
          {t('share.encourageTirage')}
        </p>
      ) : null}
    </div>
  )
}
