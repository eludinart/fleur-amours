'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { dreamscapeApi } from '@/api/dreamscape'
import { FlowerSVG } from '@/components/FlowerSVG'
import { getShareBaseUrl } from '@/utils/dreamscapeShare'
import { ogMetaDescriptionDreamscape, ogMetaTitleDreamscape } from '@/lib/og-share-copy'
import { proxyImageUrl } from '@/lib/api-client'
import { ALL_CARDS, BACK_IMG } from '@/data/tarotCards'
import { t } from '@/i18n'
import { ShareLandingShell, ShareLandingChipRow } from '@/components/share/ShareLandingShell'
import { buildShareLandingPaths, dreamscapeLandingCopy } from '@/lib/share-landing-presets'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function formatDate(s: string | undefined) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function findCardByName(name: string | undefined) {
  if (!name) return null
  return ALL_CARDS.find((c) => (c.name || '').toLowerCase() === (name || '').toLowerCase()) ?? null
}

type SharedItem = {
  history?: Array<{
    role?: string
    content?: string
    path?: string[]
    actions?: string[]
  }>
  poeticReflection?: string | null
  snapshot?: string | null
  savedAt?: string
  slots?: Array<{ position?: string; card?: string; faceDown?: boolean }>
  petals?: Record<string, number>
}

export default function DreamscapePartagePage() {
  const pathname = usePathname()
  const token = pathname?.match(/\/partage\/([^/]+)/)?.[1] ?? null
  const [item, setItem] = useState<SharedItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError(t('share.landingInvalidLink'))
      setLoading(false)
      return
    }
    dreamscapeApi
      .getShared(token)
      .then((data) => setItem(data as SharedItem))
      .catch((e: Error) => setError(e?.message || t('share.landingDreamscapeNotFound')))
      .finally(() => setLoading(false))
  }, [token])

  const closing = item?.history?.find((m) => m.role === 'closing')
  const synthesis = item?.poeticReflection || closing?.content
  const shareUrl = token ? `${getShareBaseUrl()}/dreamscape/partage/${token}` : ''

  useEffect(() => {
    if (!item || !token) return
    document.title = 'Promenade Onirique partagée — Fleur d\'AmOurs'
    const desc = ogMetaDescriptionDreamscape(synthesis)
    const title = ogMetaTitleDreamscape()
    const metaOg = [
      { property: 'og:title', content: title },
      { property: 'og:description', content: desc },
      { property: 'og:url', content: shareUrl },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: desc },
    ]
    const apiBase = typeof window !== 'undefined' ? window.location.origin : ''
    const bp = basePath.startsWith('/') ? basePath : `/${basePath}`
    const ogImgUrl = `${apiBase}${bp}/api/og/dreamscape?token=${encodeURIComponent(token)}`
    metaOg.push({ property: 'og:image', content: ogImgUrl })
    metaOg.push({ name: 'twitter:image', content: ogImgUrl })
    metaOg.forEach(({ property, name, content }) => {
      const attr = property ? 'property' : 'name'
      const key = property || name
      let el = document.querySelector(`meta[${attr}="${key}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key || '')
        document.head.appendChild(el)
      }
      el.setAttribute('content', content || '')
    })
    return () => {
      document.title = "Fleur d'AmOurs"
    }
  }, [item, token, synthesis, shareUrl])

  const paths = buildShareLandingPaths(basePath)
  const copy = dreamscapeLandingCopy()
  const dreamscapeHref = `${basePath.startsWith('/') ? basePath : `/${basePath}`}/dreamscape`

  if (loading) {
    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center p-6"
        style={{
          background: 'linear-gradient(148deg, #020617 0%, #1e1b4b 48%, #0f172a 100%)',
        }}
      >
        <span className="h-12 w-12 animate-spin rounded-full border-2 border-violet-200 border-t-violet-500" />
        <p className="mt-4 text-sm text-white/70">{t('share.landingLoadingDreamscape')}</p>
      </div>
    )
  }

  if (error || !item) {
    const bp = basePath.startsWith('/') ? basePath : `/${basePath}`
    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 p-6"
        style={{
          background: 'linear-gradient(148deg, #020617 0%, #1e1b4b 48%, #0f172a 100%)',
        }}
      >
        <p className="text-center text-amber-400">{error || t('share.landingDreamscapeNotFound')}</p>
        <Link
          href={bp}
          className="rounded-xl bg-violet-600 px-6 py-3 font-medium text-white transition-colors hover:bg-violet-500"
        >
          {t('share.landingDreamscapeCtaHome')}
        </Link>
      </div>
    )
  }

  const excerpt =
    synthesis && typeof synthesis === 'string'
      ? synthesis.replace(/\s+/g, ' ').trim().length > 280
        ? `${synthesis.replace(/\s+/g, ' ').trim().slice(0, 279)}…`
        : synthesis.replace(/\s+/g, ' ').trim()
      : ''

  return (
    <ShareLandingShell
      brandName={copy.brandName}
      brandLine={copy.brandLine}
      freeLabel={copy.freeLabel}
      footerMicro={copy.footerMicro}
      primaryCta={{ href: dreamscapeHref, label: copy.ctaLabel }}
      secondaryCta={{ href: paths.loginHref, label: t('share.landingLogin') }}
      variant="dark"
    >
      <p className="mb-6 text-center text-[11px] text-slate-500 sm:text-left">
        <span className="text-slate-500">{formatDate(item.savedAt)}</span>
        <span className="mx-2 text-slate-600">·</span>
        <Link href={paths.homeHref} className="text-violet-400 hover:text-violet-300">
          {t('dreamscapePartage.back')}
        </Link>
      </p>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {item.snapshot ? (
          <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.snapshot}
              alt=""
              className="max-h-[min(360px,45vh)] w-full object-cover object-center"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/40 to-transparent"
              aria-hidden
            />
          </div>
        ) : null}

        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200/90">{copy.kicker}</p>
          <p className="text-2xl font-extrabold leading-tight text-slate-50 sm:text-3xl">{copy.hook}</p>
          <p className="text-base font-medium leading-snug text-slate-300/85">{copy.sub}</p>

          {excerpt ? (
            <blockquote className="border-l-4 border-violet-400/75 pl-4 font-serif text-lg italic leading-relaxed text-slate-100/95 sm:text-xl">
              « {excerpt} »
            </blockquote>
          ) : null}

          {closing?.path && closing.path.length > 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-amber-300/90">
                {t('dreamscapeCanvas.pathLabel')}
              </p>
              <p className="text-sm text-white/90">{closing.path.join(' → ')}</p>
            </div>
          ) : null}

          {closing?.actions && closing.actions.length > 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-emerald-300/90">
                {t('dreamscapeCanvas.actionsLabel')}
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-white/90">
                {closing.actions.map((a: string, i: number) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!item.snapshot && item.slots && item.slots.length > 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-violet-300/90">
                {t('dreamscapeHistorique.snapshot')}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {item.slots.map((slot, j) => {
                  const card = findCardByName(slot.card)
                  const img = slot.faceDown ? BACK_IMG : card?.img || BACK_IMG
                  return (
                    <div key={j} className="flex flex-col items-center gap-1">
                      <div
                        className="h-24 w-16 overflow-hidden rounded-lg border border-white/20"
                        title={slot.faceDown ? 'Face cachée' : slot.card}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={proxyImageUrl(img) ?? img ?? ''}
                          alt={slot.card || ''}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="text-[10px] text-white/60">{slot.position}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {item.petals && Object.keys(item.petals).some((k) => (item.petals![k] ?? 0) > 0) ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-emerald-300/90">Fleur</p>
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
          ) : null}

          <div className="flex flex-col gap-2.5 pt-2">
            <ShareLandingChipRow items={copy.chipsPrimary} />
            <ShareLandingChipRow items={copy.chipsTrust} />
          </div>
        </div>
      </div>
    </ShareLandingShell>
  )
}
