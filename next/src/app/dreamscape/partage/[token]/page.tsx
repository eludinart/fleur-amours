import { DreamscapePartagePublicPage } from '@/components/share/DreamscapePartagePublicPage'
import { buildDreamscapePartageMetadata } from '@/lib/share-route-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!/^[a-f0-9]{32}$/i.test(token)) return {}
  return buildDreamscapePartageMetadata(token)
}

export default function DreamscapePartageRoutePage() {
  return <DreamscapePartagePublicPage />
}
