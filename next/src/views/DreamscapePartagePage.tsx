// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { dreamscapeApi } from '@/api/dreamscape'
import { FlowerSVG } from '@/components/FlowerSVG'
import { getShareBaseUrl, getSharedImageUrl } from '@/utils/dreamscapeShare'
import { proxyImageUrl } from '@/lib/api-client'
import { ALL_CARDS, BACK_IMG } from '@/data/tarotCards'
import { t } from '@/i18n'

function formatDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function findCardByName(name) {
  if (!name) return null
  return ALL_CARDS.find(c => (c.name || '').toLowerCase() === (name || '').toLowerCase()) ?? null
}

export default function DreamscapePartagePage() {
  const pathname = usePathname()
  const token = pathname?.match(/\/partage\/([^/]+)/)?.[1] ?? null
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) {
      setError('Lien invalide')
      setLoading(false)
      return
    }
    dreamscapeApi.getShared(token)
      .then(setItem)
      .catch((e) => setError(e?.message || 'Partage introuvable'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <span className="w-12 h-12 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
        <p className="mt-4 text-white/70">Chargement du tirage partagé…</p>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <p className="text-amber-400 text-center mb-6">{error || 'Partage introuvable'}</p>
        <Link
          href="/"
          className="px-6 py-3 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 transition-colors"
        >
          {t('common.back')}
        </Link>
      </div>
    )
  }

  const closing = item.history?.find(m => m.role === 'closing')
  const synthesis = item.poeticReflection || closing?.content
  const shareUrl = `${getShareBaseUrl()}/dreamscape/partage/${token}`

  useEffect(() => {
    document.title = 'Promenade Onirique partagée — Fleur d\'AmOurs'
    const metaOg = [
      { property: 'og:title', content: 'Promenade Onirique — Fleur d\'AmOurs' },
      { property: 'og:description', content: (synthesis || '').slice(0, 200) + (synthesis?.length > 200 ? '…' : '') },
      { property: 'og:url', content: shareUrl },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Promenade Onirique — Fleur d\'AmOurs' },
    ]
    if (item.snapshot) {
      const imgUrl = getSharedImageUrl(token)
      metaOg.push({ property: 'og:image', content: imgUrl })
      metaOg.push({ name: 'twitter:image', content: imgUrl })
    }
    metaOg.forEach(({ property, name, content }) => {
      const attr = property ? 'property' : 'name'
      const key = property || name
      let el = document.querySelector(`meta[${attr}="${key}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content || '')
    })
    return () => { document.title = 'Fleur d\'AmOurs' }
  }, [token, synthesis, item.snapshot, shareUrl])

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-violet-400 hover:text-violet-300"
          >
            ← {t('dreamscapePartage.back')}
          </Link>
          <span className="text-xs text-white/50">
            {formatDate(item.savedAt)}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-center text-white/90">
          {t('dreamscapePartage.title')}
        </h1>

        {item.snapshot && (
          <div className="w-fit mx-auto">
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate-900">
              <img
                src={item.snapshot}
                alt="Tirage Dreamscape"
                className="max-w-md max-h-[360px] w-auto block object-contain"
              />
            </div>
          </div>
        )}

        {synthesis && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <p className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">
              {t('dreamscapePartage.synthesis')}
            </p>
            <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
              {synthesis}
            </p>
          </div>
        )}

        {closing?.path?.length > 0 && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              {t('dreamscapeCanvas.pathLabel')}
            </p>
            <p className="text-white/90">
              {closing.path.join(' → ')}
            </p>
          </div>
        )}

        {closing?.actions?.length > 0 && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
              {t('dreamscapeCanvas.actionsLabel')}
            </p>
            <ul className="text-white/90 space-y-1 list-disc list-inside">
              {closing.actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {!item.snapshot && item.slots?.length > 0 && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 w-fit mx-auto">
            <p className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-3">
              {t('dreamscapeHistorique.snapshot')}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {item.slots.map((slot, j) => {
                const card = findCardByName(slot.card)
                const img = slot.faceDown ? BACK_IMG : (card?.img || BACK_IMG)
                return (
                  <div key={j} className="flex flex-col items-center gap-1">
                    <div
                      className="w-16 h-24 rounded-lg overflow-hidden border border-white/20"
                      title={slot.faceDown ? 'Face cachée' : slot.card}
                    >
                      <img
                        src={proxyImageUrl(img) ?? img ?? ''}
                        alt={slot.card}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[10px] text-white/60">{slot.position}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {item.petals && Object.keys(item.petals).some(k => item.petals[k] > 0) && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">
              Fleur
            </p>
            <div className="flex justify-center">
              <FlowerSVG
                petals={item.petals}
                size={160}
                animate={false}
                showLabels
                showScores={false}
              />
            </div>
          </div>
        )}

        <div className="text-center pt-4">
          <Link
            href="/dreamscape"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-violet-600 to-rose-500 text-white font-medium hover:opacity-90 transition-opacity"
          >
            {t('dreamscapePartage.cta')}
          </Link>
        </div>
      </div>
    </div>
  )
}
