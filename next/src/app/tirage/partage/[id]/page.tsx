import { TiragePartagePublicPage } from '@/components/share/TiragePartagePublicPage'
import { buildTiragePartageMetadata } from '@/lib/share-route-metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return {}
  return buildTiragePartageMetadata(id)
}

export default function TiragePartageRoutePage() {
  return <TiragePartagePublicPage />
}
