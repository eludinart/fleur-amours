'use client'

import { useCallback, useState } from 'react'
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

function summary(r: {
  type?: string
  card?: { name?: string }
  cards?: Array<{ name?: string }>
}): string {
  if (r.type === 'simple') return r.card?.name ?? '—'
  if (r.type === 'four' && r.cards?.length)
    return r.cards.map((c) => c.name).join(' · ')
  return '—'
}

type ShareTirageButtonProps = {
  reading?: {
    id?: string
    type?: string
    card?: { name?: string }
    cards?: Array<{ name?: string }>
    createdAt?: string
  }
  /** Afficher le libellé « Partager » pour un CTA plus visible */
  showLabel?: boolean
}

export function ShareTirageButton({ reading, showLabel = true }: ShareTirageButtonProps) {
  useStore((s) => s.locale)
  const [menuOpen, setMenuOpen] = useState(false)

  const base = typeof window !== 'undefined' ? `${window.location.origin}${basePath}`.replace(/\/+$/, '') : ''
  const url = reading?.id ? `${base}/tirage?reading=${reading.id}` : `${base}/tirage`
  const text = reading
    ? `Mon tirage Fleur d'AmOurs (${reading.type === 'simple' ? t('tarot.simple') : t('tarot.fourDoors')}) : ${summary(reading)} — ${formatDate(reading.createdAt)}`
    : t('share.tirageShareText')

  const sharePayload = {
    url,
    title: "Mon tirage Fleur d'AmOurs",
    text,
  }

  const handleShare = useCallback(async () => {
    // Mobile : priorité au partage natif (ouvre WhatsApp, Twitter, etc.)
    if (canUseNativeShare()) {
      try {
        await navigator.share({
          title: sharePayload.title,
          text: sharePayload.text,
          url,
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
  }, [reading, url])

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
