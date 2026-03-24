import { Providers } from '@/components/providers'
import { PageMetadata } from '@/components/PageMetadata'
import { NetworkStatusBanner } from '@/components/NetworkStatusBanner'

export default function CatchAllLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <PageMetadata />
      <NetworkStatusBanner />
      {children}
    </Providers>
  )
}
