'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from '@/hooks/useToast'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { canUseNativeShare } from '@/utils/share-social'
import { ShareSocialButtons } from './ShareSocialButtons'

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
    const intentionLine = r.intention ? `\nIntention : ${r.intention.slice(0, 60)}${r.intention.length > 60 ? '…' : ''}` : ''
    return `J'ai tiré ${cardLine}${synthSnippet}${intentionLine}\n\nTirage ${typeLabel} — Fleur d'AmOurs 🌸`
  }

  if (r.type === 'four' && r.cards?.length) {
    const names = r.cards.map((c) => c.name).join(' · ')
    const intentionLine = r.intention ? `\nIntention : ${r.intention.slice(0, 60)}${r.intention.length > 60 ? '…' : ''}` : ''
    return `Mon tirage 4 Portes : ${names}${intentionLine}\n\nFleur d'AmOurs 🌸`
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
  }
  showLabel?: boolean
}

export function ShareTirageButton({ reading, showLabel = true }: ShareTirageButtonProps) {
  useStore((s) => s.locale)
  const [menuOpen, setMenuOpen] = useState(false)

  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${basePath}`.replace(/\/+$/, '')
      : ''

  // Prefer a beautiful public share page over the protected /tirage route
  const publicPageUrl =
    reading?.id ? `${base}/tirage/partage/${reading.id}` : `${base}/tirage`

  const text = buildShareText(reading || {})

  const sharePayload = {
    url: publicPageUrl,
    title: "Mon tirage Fleur d'AmOurs",
    text,
  }

  // Inject OG meta for current page when a reading is open
  useEffect(() => {
    if (!reading?.id || typeof window === 'undefined') return
    const ogImgUrl = `${window.location.origin}${basePath}/api/og/tirage?id=${reading.id}`
    const cardName = reading.type === 'simple'
      ? (reading.card?.name || '')
      : (reading.cards?.map((c) => c.name).join(' · ') || '')
    const metas: Array<{ attr: string; key: string; content: string }> = [
      { attr: 'property', key: 'og:image', content: ogImgUrl },
      { attr: 'property', key: 'og:title', content: `Mon tirage — ${cardName}` },
      { attr: 'name', key: 'twitter:card', content: 'summary_large_image' },
      { attr: 'name', key: 'twitter:image', content: ogImgUrl },
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
  }, [reading?.id])

  const handleShare = useCallback(async () => {
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
  }, [reading, publicPageUrl])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleShare}
        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/50 hover:border-violet-300 dark:hover:border-violet-700 transition-colors`}
        title={t('common.share')}
        aria-label={t('common.share')}
      >
        <span>📤</span>
        {showLabel && <span>{t('common.share')}</span>}
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3 min-w-[200px]">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{t('common.share')}</p>
            <ShareSocialButtons payload={sharePayload} onCopyLink={() => setMenuOpen(false)} variant="labels" />
          </div>
        </>
      )}
    </div>
  )
}
