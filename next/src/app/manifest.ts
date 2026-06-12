import type { MetadataRoute } from 'next'

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin').replace(/\/$/, '')

/**
 * Web App Manifest — permet l’installation PWA (écran d’accueil) sur Android Chrome
 * et une meilleure intégration iOS (meta complétées dans layout.tsx).
 */
export default function manifest(): MetadataRoute.Manifest {
  const icon = `${basePath}/juste-la-fleur.png`
  return {
    name: "Fleur d'AmOurs",
    short_name: 'Fleur',
    description: "Jardin Fleur d'AmOurs — clarté et transformation relationnelle",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    lang: 'fr',
    icons: [
      {
        src: icon,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: icon,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: icon,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
