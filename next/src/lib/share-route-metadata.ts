import type { Metadata } from 'next'
import { isDbConfigured } from '@/lib/db'
import { getShared } from '@/lib/db-dreamscape'
import { getById } from '@/lib/db-tarot'
import { getSocialPreviewOrigin } from '@/lib/social-preview-origin'
import {
  ogMetaDescriptionDreamscape,
  ogMetaDescriptionFleur,
  ogMetaDescriptionTirage,
  ogMetaTitleDreamscape,
  ogMetaTitleFleur,
  ogMetaTitleTirage,
} from '@/lib/og-share-copy'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

/** LinkedIn : 1200×627, PNG explicite dans les métadonnées. */
const OG_W = 1200
const OG_H = 627

function socialMetadata(args: {
  title: string
  description: string
  pageUrl: string
  ogImageUrl: string
  imageAlt: string
}): Metadata {
  const { title, description, pageUrl, ogImageUrl, imageAlt } = args
  return {
    title: `${title} — Fleur d'AmOurs`,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "Fleur d'AmOurs",
      images: [
        {
          url: ogImageUrl,
          width: OG_W,
          height: OG_H,
          type: 'image/png',
          alt: imageAlt,
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

export async function buildTiragePartageMetadata(id: string): Promise<Metadata> {
  const origin = await getSocialPreviewOrigin()
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

  return socialMetadata({
    title,
    description,
    pageUrl,
    ogImageUrl,
    imageAlt: title,
  })
}

export async function buildDreamscapePartageMetadata(token: string): Promise<Metadata> {
  const origin = await getSocialPreviewOrigin()
  let synthesisSnippet: string | null = null
  if (isDbConfigured()) {
    try {
      const data = await getShared(token)
      synthesisSnippet = (data.poeticReflection as string) || null
      if (!synthesisSnippet) {
        const history = (data.history as Array<{ role?: string; content?: string }>) || []
        synthesisSnippet = history.find((m) => m.role === 'closing')?.content || null
      }
    } catch {
      /* fallback image OG */
    }
  }
  const title = ogMetaTitleDreamscape()
  const description = ogMetaDescriptionDreamscape(synthesisSnippet)
  const pageUrl = `${origin}${basePath}/dreamscape/partage/${token}`
  const ogImageUrl = `${origin}${basePath}/api/og/dreamscape?token=${encodeURIComponent(token)}`
  return socialMetadata({
    title,
    description,
    pageUrl,
    ogImageUrl,
    imageAlt: title,
  })
}

export async function buildFleurResultMetadata(resultId: string): Promise<Metadata> {
  const origin = await getSocialPreviewOrigin()
  const title = ogMetaTitleFleur()
  const description = ogMetaDescriptionFleur()
  const pageUrl = `${origin}${basePath}/fleur?result=${resultId}`
  const ogImageUrl = `${origin}${basePath}/api/og/fleur?id=${resultId}`
  return socialMetadata({
    title,
    description,
    pageUrl,
    ogImageUrl,
    imageAlt: title,
  })
}
