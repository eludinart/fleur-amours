/**
 * Normalisation prod / dev pour la télémétrie (stockage + filtres admin).
 * Utilisé côté serveur à l'ingestion et côté client pour l'envoi.
 */
export type TelemetryTier = 'production' | 'development'

export function normalizeTelemetryEnv(
  raw: string | null | undefined,
  opts?: { hostname?: string | null }
): TelemetryTier {
  const t = (raw || '').trim().toLowerCase()
  if (t === 'production' || t === 'prod' || t === 'prd') return 'production'
  if (
    t === 'development' ||
    t === 'dev' ||
    t === 'local' ||
    t === 'staging' ||
    t === 'preview' ||
    t === 'test'
  ) {
    return 'development'
  }
  const h = (opts?.hostname || '')
    .toLowerCase()
    .split(':')[0]
    .trim()
  if (!h) return 'production'
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return 'development'
  return 'production'
}

/** Contexte serveur au moment où l’API reçoit le batch. */
export function resolveServerIngestTelemetryEnv(): TelemetryTier {
  if (process.env.NODE_ENV === 'development') return 'development'
  const vercel = (process.env.VERCEL_ENV || '').toLowerCase()
  if (vercel === 'preview' || vercel === 'development') return 'development'
  const app = (process.env.APP_ENV || '').trim().toLowerCase()
  if (app === 'development' || app === 'dev' || app === 'local') return 'development'
  if (app === 'production' || app === 'prod') return 'production'
  return 'production'
}

/**
 * Si le serveur tourne en mode dev, on force `development` (évite de mélanger avec la prod).
 * Sinon on fait confiance au client (build NEXT_PUBLIC_*) avec repli sur le host.
 */
export function mergeIngestTelemetryEnv(
  clientEnvRaw: string | null | undefined,
  appHost: string | null | undefined
): TelemetryTier {
  const server = resolveServerIngestTelemetryEnv()
  if (server === 'development') return 'development'
  return normalizeTelemetryEnv(clientEnvRaw, { hostname: appHost })
}
