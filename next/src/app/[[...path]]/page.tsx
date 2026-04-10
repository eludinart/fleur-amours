import type { Metadata } from 'next'
import { AppShell } from '@/components/AppShell'
import { buildFleurResultMetadata } from '@/lib/share-route-metadata'

export function generateStaticParams() {
  return [{ path: [] }]
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { path: pathSegments = [] } = await params
  const sp = await searchParams
  const segs = pathSegments ?? []

  /* Tirage / Dreamscape partage : routes dédiées app/tirage/... et app/dreamscape/... (OG fiable pour LinkedIn). */

  if (segs[0] === 'fleur' && segs.length === 1) {
    const raw = sp.result
    const resultParam = Array.isArray(raw) ? raw[0] : raw
    if (resultParam && /^\d+$/.test(resultParam)) {
      return buildFleurResultMetadata(resultParam)
    }
  }

  return {}
}

export default function CatchAllPage() {
  return <AppShell />
}
