// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { t } from '@/i18n'
import { BACK_IMG } from '@/data/tarotCards'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function formatDate(s?: string): string {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function proxyImg(url: string): string {
  if (!url) return BACK_IMG
  return url
}

function CardDisplay({ card, showName = true }: { card: { name?: string; img?: string; synth?: string }; showName?: boolean }) {
  const [imgErr, setImgErr] = useState(false)
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <img
          src={imgErr ? BACK_IMG : proxyImg(card.img || '')}
          alt={card.name || ''}
          className="w-32 h-48 object-contain rounded-xl border border-white/10 shadow-[0_0_30px_rgba(139,92,246,0.3)]"
          onError={() => setImgErr(true)}
        />
      </div>
      {showName && card.name && (
        <span className="px-3 py-1 rounded-full bg-violet-900/40 border border-violet-500/30 text-violet-200 text-sm font-medium">
          {card.name}
        </span>
      )}
    </div>
  )
}

function SynthPanel({ synth }: { synth: string }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
      <p className="text-sm font-semibold text-violet-400 uppercase tracking-wider mb-2">Synthèse</p>
      <p className="text-white/85 leading-relaxed italic">{synth}</p>
    </div>
  )
}

export default function TiragePartagePage() {
  const pathname = usePathname()
  const id = pathname?.match(/\/tirage\/partage\/(\d+)/)?.[1] ?? null

  const [reading, setReading] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) {
      setError('Lien invalide')
      setLoading(false)
      return
    }

    fetch(`${basePath}/api/tarot_readings/${id}/public`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Tirage introuvable')
        return res.json()
      })
      .then((data) => {
        setReading(data)
        // Inject OG meta tags for social previews (client-side fallback)
        const ogImgUrl = `${window.location.origin}${basePath}/api/og/tirage?id=${id}`
        const shareUrl = window.location.href
        const cardName = data.type === 'simple' ? (data.card?.name || '') : (data.cards?.map(c => c.name).join(' · ') || '')
        const title = `Mon tirage — ${cardName}`
        const desc = data.type === 'simple' ? (data.card?.synth || '') : (data.synthesis || '')
        const metas = [
          { property: 'og:title', content: title },
          { property: 'og:description', content: desc.slice(0, 200) },
          { property: 'og:url', content: shareUrl },
          { property: 'og:image', content: ogImgUrl },
          { property: 'og:type', content: 'website' },
          { name: 'twitter:card', content: 'summary_large_image' },
          { name: 'twitter:title', content: title },
          { name: 'twitter:image', content: ogImgUrl },
        ]
        document.title = `${title} — Fleur d'AmOurs`
        metas.forEach(({ property, name, content }) => {
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
      })
      .catch((e) => setError(e?.message || 'Tirage introuvable'))
      .finally(() => setLoading(false))

    return () => { document.title = "Fleur d'AmOurs" }
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <span className="w-12 h-12 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
        <p className="mt-4 text-white/60 text-sm">Chargement du tirage…</p>
      </div>
    )
  }

  if (error || !reading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-4xl">🃏</div>
        <p className="text-amber-400 text-center">{error || 'Tirage introuvable'}</p>
        <Link
          href={`${basePath}/tirage`}
          className="px-6 py-3 rounded-full bg-gradient-to-r from-violet-600 to-purple-700 text-white font-medium hover:opacity-90 transition-opacity"
        >
          Faire mon propre tirage
        </Link>
      </div>
    )
  }

  const isSimple = reading.type !== 'four'
  const card = reading.card
  const cards = reading.cards || []

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/8 blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-rose-600/6 blur-[100px]" />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href={`${basePath}/tirage`}
            className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            ← Retour
          </Link>
          <span className="text-xs text-white/40">{formatDate(reading.createdAt || reading.created_at)}</span>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-[3px]">
            {isSimple ? 'Tirage Simple' : 'Tirage 4 Portes'}
          </p>
          <h1 className="text-2xl font-bold text-white/90">
            {isSimple ? (card?.name || 'Tirage') : cards.map(c => c.name).join(' · ')}
          </h1>
        </div>

        {/* Cards display */}
        {isSimple && card && (
          <div className="flex justify-center">
            <CardDisplay card={card} showName={false} />
          </div>
        )}

        {!isSimple && cards.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4">
            {cards.map((c, i) => (
              <CardDisplay key={i} card={c} showName />
            ))}
          </div>
        )}

        {/* Intention */}
        {reading.intention && (
          <div className="rounded-2xl bg-violet-900/20 border border-violet-500/20 p-5">
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">Intention</p>
            <p className="text-white/85 italic">{reading.intention}</p>
          </div>
        )}

        {/* Synth / description */}
        {isSimple && (card?.synth || card?.desc) && (
          <SynthPanel synth={card.synth || card.desc} />
        )}
        {!isSimple && (reading.synthesis || reading.interpretation) && (
          <SynthPanel synth={reading.synthesis || reading.interpretation} />
        )}

        {/* Reflection */}
        {reading.reflection && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Réflexion</p>
            <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{reading.reflection}</p>
          </div>
        )}

        {/* CTA section */}
        <div className="text-center pt-6 space-y-4">
          <p className="text-white/50 text-sm">Cette carte résonne en vous ?</p>
          <Link
            href={`${basePath}/register`}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-violet-600 to-rose-500 text-white font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-violet-900/40"
          >
            🌸 Faire mon propre tirage
          </Link>
          <div className="flex items-center justify-center gap-3 pt-2">
            <span className="text-xs text-white/30">Déjà jardinier ?</span>
            <Link
              href={`${basePath}/login`}
              className="text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2"
            >
              Se connecter
            </Link>
          </div>
        </div>

        {/* Brand footer */}
        <div className="text-center pt-4 pb-6">
          <p className="text-xs text-white/20">🌸 Fleur d'AmOurs — Explorez vos cartes d'amour</p>
        </div>
      </div>
    </div>
  )
}
