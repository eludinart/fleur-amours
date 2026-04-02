import type { Metadata } from 'next'
import { AppShell } from '@/components/AppShell'
import { isDbConfigured } from '@/lib/db'
import { getById } from '@/lib/db-tarot'
import { ogMetaDescriptionTirage, ogMetaTitleTirage } from '@/lib/og-share-copy'

export function generateStaticParams() {
  return [{ path: [] }]
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function siteOrigin(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (u) return u.replace(/\/+$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`
  return 'https://www.eludein.art'
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ path?: string[] }>
}): Promise<Metadata> {
  const { path: pathSegments = [] } = await params
  const segs = pathSegments ?? []

  if (
    segs[0] === 'tirage' &&
    segs[1] === 'partage' &&
    segs[2] &&
    /^\d+$/.test(segs[2])
  ) {
    const id = segs[2]
    const origin = siteOrigin()
    let cardName = ''
    let synthSnippet: string | null = null

    if (isDbConfigured()) {
      try {
        const reading = await getById(Number(id))
        if (reading) {
          const type = reading.type as string
          if (type === 'simple') {
            const card = reading.card as { name?: string; synth?: string } | undefined
            cardName = card?.name || ''
            synthSnippet = card?.synth || null
          } else {
            const cards = reading.cards as Array<{ name?: string }> | undefined
            cardName = cards?.map((c) => c.name).filter(Boolean).join(' · ') || ''
            synthSnippet = (reading.synthesis as string) || null
          }
        }
      } catch {
        /* ignore */
      }
    }

    const title = ogMetaTitleTirage(cardName)
    const description = ogMetaDescriptionTirage(cardName || 'tarot', synthSnippet)
    const pageUrl = `${origin}${basePath}/tirage/partage/${id}`
    const ogImageUrl = `${origin}${basePath}/api/og/tirage?id=${id}`

    return {
      title: `${title} — Fleur d'AmOurs`,
      description,
      openGraph: {
        title,
        description,
        url: pageUrl,
        siteName: "Fleur d'AmOurs",
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        type: 'website',
        locale: 'fr_FR',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImageUrl],
      },
    }
  }

  return {}
}

export default function CatchAllPage() {
  return <AppShell />
}
