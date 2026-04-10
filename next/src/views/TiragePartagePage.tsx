'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { t } from '@/i18n'
import { ogMetaDescriptionTirage, ogMetaTitleTirage } from '@/lib/og-share-copy'
import { BACK_IMG } from '@/data/tarotCards'
import { FlowerSVG } from '@/components/FlowerSVG'
import { ShareLandingShell, ShareLandingChipRow } from '@/components/share/ShareLandingShell'
import { buildShareLandingPaths, tirageLandingCopy } from '@/lib/share-landing-presets'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

type PublicCard = { name?: string; img?: string; synth?: string; desc?: string }

type PublicReading = {
  type?: string
  card?: PublicCard
  cards?: PublicCard[]
  synthesis?: string
  interpretation?: string
  createdAt?: string
  created_at?: string
  /** Rosace Fleur d’AmOurs au moment du tirage (partage public). */
  shareFlower?: {
    petals: Record<string, number>
    capturedAt?: string
    drawPetalIds?: string[]
  }
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function formatDate(s?: string): string {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function HeroCard({ c }: { c: PublicCard }) {
  const [imgErr, setImgErr] = useState(false)
  const src = imgErr ? BACK_IMG : c.img || BACK_IMG
  return (
    <img
      src={src}
      alt={c.name || ''}
      className="max-h-[min(420px,55vh)] w-auto max-w-[min(260px,85vw)] rounded-[1.25rem] border border-violet-400/40 object-contain shadow-[0_0_72px_rgba(139,92,246,0.55),0_16px_48px_rgba(0,0,0,0.45)]"
      onError={() => setImgErr(true)}
    />
  )
}

function DoorCard({ c }: { c: PublicCard }) {
  const [imgErr, setImgErr] = useState(false)
  const src = imgErr ? BACK_IMG : c.img || BACK_IMG
  return (
    <div className="flex flex-col items-center gap-2">
      <img
        src={src}
        alt={c.name || ''}
        className="h-[min(198px,26vh)] w-auto max-w-[min(132px,24vw)] rounded-xl border border-violet-400/25 object-contain shadow-[0_0_28px_rgba(139,92,246,0.45)]"
        onError={() => setImgErr(true)}
      />
      {c.name ? (
        <span className="max-w-[8.5rem] text-center text-[11px] font-semibold leading-tight text-slate-200/90 sm:text-xs">
          {truncate(c.name, 22)}
        </span>
      ) : null}
    </div>
  )
}

export default function TiragePartagePage() {
  const pathname = usePathname()
  const id = pathname?.match(/\/tirage\/partage\/(\d+)/)?.[1] ?? null

  const [reading, setReading] = useState<PublicReading | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError(t('share.landingInvalidLink'))
      setLoading(false)
      return
    }

    fetch(`${basePath}/api/tarot_readings/${id}/public`)
      .then(async (res) => {
        if (!res.ok) throw new Error(t('share.landingNotFound'))
        return res.json() as Promise<PublicReading>
      })
      .then((data) => {
        setReading(data)
        const ogImgUrl = `${window.location.origin}${basePath}/api/og/tirage?id=${id}`
        const shareUrl = window.location.href
        const cardName =
          data.type === 'simple'
            ? data.card?.name || ''
            : data.cards?.map((c) => c.name).join(' · ') || ''
        const synthSnippet =
          data.type === 'simple' ? data.card?.synth || null : data.synthesis || null
        const title = ogMetaTitleTirage(cardName)
        const desc = ogMetaDescriptionTirage(cardName || 'tarot', synthSnippet)
        const metas = [
          { property: 'og:title', content: title },
          { property: 'og:description', content: desc },
          { property: 'og:url', content: shareUrl },
          { property: 'og:image', content: ogImgUrl },
          { property: 'og:type', content: 'website' },
          { name: 'twitter:card', content: 'summary_large_image' },
          { name: 'twitter:title', content: title },
          { name: 'twitter:description', content: desc },
          { name: 'twitter:image', content: ogImgUrl },
        ]
        document.title = `${title} — Fleur d'AmOurs`
        metas.forEach(({ property, name, content }) => {
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
      })
      .catch((e: Error) => setError(e?.message || t('share.landingNotFound')))
      .finally(() => setLoading(false))

    return () => {
      document.title = "Fleur d'AmOurs"
    }
  }, [id])

  if (loading) {
    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center p-6"
        style={{
          background: 'linear-gradient(148deg, #020617 0%, #1e1b4b 48%, #0f172a 100%)',
        }}
      >
        <span className="h-12 w-12 animate-spin rounded-full border-2 border-violet-200 border-t-violet-500" />
        <p className="mt-4 text-sm text-white/60">{t('share.landingLoadingTirage')}</p>
      </div>
    )
  }

  if (error || !reading) {
    const paths = buildShareLandingPaths(basePath)
    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 p-6"
        style={{
          background: 'linear-gradient(148deg, #020617 0%, #1e1b4b 48%, #0f172a 100%)',
        }}
      >
        <div className="text-4xl">🃏</div>
        <p className="text-center text-amber-400">{error || t('share.landingNotFound')}</p>
        <Link
          href={`${basePath}/tirage`}
          className="rounded-full bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
        >
          {t('share.landingTryOwn')}
        </Link>
        <Link href={paths.loginHref} className="text-sm text-violet-300 underline underline-offset-2">
          {t('share.landingLogin')}
        </Link>
      </div>
    )
  }

  const isSimple = reading.type !== 'four'
  const card = reading.card
  const cards = reading.cards || []
  const hasServerReading = true
  const copy = tirageLandingCopy(isSimple, hasServerReading)
  const paths = buildShareLandingPaths(basePath)

  const cardName = isSimple
    ? card?.name || t('share.landingFallbackCard')
    : cards.map((c) => c.name).filter(Boolean).join(' · ') || t('share.landingFourTitle')

  const synthText = isSimple
    ? card?.synth || card?.desc || ''
    : reading.synthesis || reading.interpretation || ''

  const sharePetals = reading.shareFlower?.petals
  const hasShareFlower =
    !!sharePetals && typeof sharePetals === 'object' && Object.keys(sharePetals).length > 0
  const shareFlowerPulseId = reading.shareFlower?.drawPetalIds?.[0] ?? null

  const primaryHref = paths.primaryHref

  return (
    <ShareLandingShell
      brandName={copy.brandName}
      brandLine={copy.brandLine}
      freeLabel={copy.freeLabel}
      footerMicro={copy.footerMicro}
      primaryCta={{ href: primaryHref, label: copy.ctaLabel }}
      secondaryCta={{ href: paths.loginHref, label: t('share.landingLogin') }}
      variant="dark"
    >
      <p className="mb-6 text-center text-[11px] text-slate-500 sm:text-left">
        <span className="text-slate-500">{formatDate(reading.createdAt || reading.created_at)}</span>
        <span className="mx-2 text-slate-600">·</span>
        <Link href={`${basePath}/tirage`} className="text-violet-400 hover:text-violet-300">
          {t('share.landingBackTirage')}
        </Link>
      </p>

      {isSimple && card ? (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-center lg:gap-6">
          <div className="flex shrink-0 flex-col items-center justify-center gap-5 lg:w-[min(340px,38%)]">
            {hasShareFlower ? (
              <div className="flex flex-col items-center rounded-2xl bg-white/[0.06] p-4 ring-1 ring-violet-400/25 shadow-[0_0_48px_rgba(139,92,246,0.2)]">
                <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-violet-200/90">
                  {t('share.landingYourFlower')}
                </p>
                <FlowerSVG
                  petals={sharePetals!}
                  size={200}
                  animate={false}
                  showLabels
                  showScores={false}
                  pulsePetalId={shareFlowerPulseId}
                />
              </div>
            ) : null}
            <HeroCard c={card} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 lg:pr-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200/90">{copy.kicker}</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-50 sm:text-5xl lg:leading-[1.06]">
              {truncate(cardName, 40)}
            </h1>
            {synthText ? (
              <blockquote className="border-l-4 border-violet-400/85 pl-4 font-serif text-lg italic leading-relaxed text-slate-100/95 sm:text-xl">
                {truncate(synthText, isSimple ? 220 : 400)}
              </blockquote>
            ) : null}
            <p className="text-xl font-extrabold leading-tight tracking-tight text-slate-50 sm:text-2xl">{copy.hook}</p>
            <p className="text-base font-medium leading-snug text-slate-300/85">{copy.sub}</p>
            <div className="flex flex-col gap-2.5 pt-1">
              <ShareLandingChipRow items={copy.chipsPrimary} />
              <ShareLandingChipRow items={copy.chipsTrust} />
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-5">
          {hasShareFlower ? (
            <div className="mx-auto flex flex-col items-center rounded-2xl bg-white/[0.06] p-4 ring-1 ring-violet-400/25 shadow-[0_0_40px_rgba(139,92,246,0.18)] sm:mx-0">
              <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-violet-200/90">
                {t('share.landingYourFlower')}
              </p>
              <FlowerSVG
                petals={sharePetals!}
                size={176}
                animate={false}
                showLabels
                showScores={false}
                pulsePetalId={shareFlowerPulseId}
              />
            </div>
          ) : null}
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200/90">{copy.kicker}</p>
          <p className="text-2xl font-extrabold leading-tight text-slate-50 sm:text-3xl">{copy.hook}</p>
          <p className="text-base font-medium text-slate-300/85">{copy.sub}</p>
          <div className="flex flex-wrap items-end justify-center gap-3 sm:justify-start sm:gap-4">
            {cards.slice(0, 4).map((c, i) => (
              <DoorCard key={i} c={c} />
            ))}
          </div>
          {cardName ? (
            <p className="text-lg font-bold text-slate-100/95 sm:text-xl">{truncate(cardName, 80)}</p>
          ) : null}
          {synthText ? (
            <blockquote className="border-l-[3px] border-violet-400/70 pl-3.5 font-serif text-base italic leading-relaxed text-slate-200/90 sm:text-lg">
              {truncate(synthText, 360)}
            </blockquote>
          ) : null}
          <div className="flex flex-col gap-2.5 pt-1">
            <ShareLandingChipRow items={copy.chipsPrimary} />
            <ShareLandingChipRow items={copy.chipsTrust} />
          </div>
        </div>
      )}
    </ShareLandingShell>
  )
}
