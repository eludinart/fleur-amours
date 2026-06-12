/**
 * Rate limiting minimal en mémoire (fenêtre glissante) — sans dépendance externe.
 * Suffisant pour un déploiement mono-instance (Coolify) ; pour du multi-instance,
 * remplacer par un backend partagé (Redis) sans changer l'API.
 */
import { NextRequest, NextResponse } from 'next/server'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 50_000

function gc(now: number): void {
  if (buckets.size < MAX_BUCKETS) return
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key)
  }
}

/** IP du client (derrière proxy Coolify/Traefik : x-forwarded-for). */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * Incrémente le compteur `scope:key` et indique si la limite est dépassée.
 * @returns null si OK, sinon une réponse 429 prête à renvoyer.
 */
export function rateLimit(
  scope: string,
  key: string,
  opts: { limit: number; windowMs: number }
): NextResponse | null {
  const now = Date.now()
  gc(now)
  const id = `${scope}:${key}`
  const bucket = buckets.get(id)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + opts.windowMs })
    return null
  }
  bucket.count += 1
  if (bucket.count <= opts.limit) return null
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  return NextResponse.json(
    { error: 'Trop de tentatives. Réessayez dans quelques instants.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}
