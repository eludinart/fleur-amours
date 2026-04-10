import type { MetadataRoute } from 'next'

/**
 * Avec basePath `/jardin`, ce fichier est servi sous `/jardin/robots.txt`.
 * Les crawlers sociaux (LinkedInBot, etc.) doivent pouvoir lire la page et l’image OG.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
      {
        userAgent: 'LinkedInBot',
        allow: '/',
      },
      {
        userAgent: 'facebookexternalhit',
        allow: '/',
      },
      {
        userAgent: 'Facebot',
        allow: '/',
      },
    ],
  }
}
