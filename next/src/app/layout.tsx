import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import './globals.css'
import { TelemetryClient } from '@/components/telemetry/TelemetryClient'
import InstallPwaBanner from '@/components/InstallPwaBanner'
import { getAppPublicOrigin } from '@/lib/app-public-url'

const basePathSeg = (process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin').replace(/\/$/, '')
const publicOrigin = getAppPublicOrigin()
const metadataBase =
  publicOrigin && publicOrigin.startsWith('http')
    ? new URL(`${publicOrigin.replace(/\/+$/, '')}${basePathSeg}/`)
    : undefined

const iconPath = `${basePathSeg}/juste-la-fleur.png`

export const metadata: Metadata = {
  metadataBase,
  title: "Fleur d'AmOurs",
  description: "Jardin Fleur d'AmOurs",
  applicationName: "Fleur d'AmOurs",
  appleWebApp: {
    capable: true,
    title: "Fleur d'AmOurs",
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  manifest: `${basePathSeg}/manifest.webmanifest`,
  icons: {
    icon: [{ url: iconPath, type: 'image/png' }],
    apple: [{ url: iconPath, type: 'image/png' }],
    shortcut: iconPath,
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className="dark">
      <head>
        <link rel="icon" href={iconPath} type="image/png" sizes="any" />
        <link rel="apple-touch-icon" href={iconPath} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen min-h-[100svh] min-h-[100dvh] bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans antialiased">
        <Suspense fallback={null}>
          <TelemetryClient />
          <InstallPwaBanner />
        </Suspense>
        {children}
      </body>
    </html>
  )
}
