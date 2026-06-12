import jwt from 'jsonwebtoken'

/**
 * Rôles applicatifs reconnus dans le payload JWT (`role`).
 * - `admin` : accès total.
 * - `coach` : espace accompagnant (Floraison).
 * - `manager` / `rh` : espace entreprise (Mycelium) — l'appartenance fine
 *   organisation/équipe vit dans `fleur_memberships`, pas dans le token.
 * - autres (`subscriber`, …) : utilisateur standard (Éclosion).
 */
export type AppRole = 'admin' | 'administrator' | 'coach' | 'manager' | 'rh' | 'subscriber' | string

const DEV_FALLBACK = 'dev-secret-change-in-production'

function getSecret(): string {
  const rawSecret = process.env.JWT_SECRET || DEV_FALLBACK
  if (rawSecret === DEV_FALLBACK && process.env.NODE_ENV === 'production') {
    throw new Error(
      '[FATAL] JWT_SECRET non défini ou égal au fallback de développement. ' +
        "Définissez une valeur forte dans les variables d'environnement de production."
    )
  }
  return rawSecret
}

function getExpireHours(): number {
  const n = parseInt(process.env.JWT_EXPIRE_HOURS || '720', 10)
  return Number.isFinite(n) && n > 0 ? n : 720
}

export function jwtEncode(payload: { sub: string; role?: string; email?: string }): string {
  return jwt.sign(
    { ...payload, iat: Math.floor(Date.now() / 1000) },
    getSecret(),
    { expiresIn: `${getExpireHours()}h` }
  )
}

export function jwtDecode(token: string): { sub: string; role?: string; email?: string } | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as { sub: string; role?: string; email?: string }
    return decoded
  } catch {
    return null
  }
}

/** Fenêtre de grâce du refresh : un token expiré depuis plus longtemps est rejeté. */
const REFRESH_GRACE_SECONDS = 7 * 24 * 3600

/**
 * Vérifie la signature sans rejeter immédiatement les tokens expirés
 * (réservé à /api/auth/refresh). Au-delà de la fenêtre de grâce, le token
 * est définitivement invalide et l'utilisateur doit se reconnecter.
 */
export function jwtDecodeForRefresh(token: string): { sub: string; role?: string; email?: string } | null {
  try {
    const decoded = jwt.verify(token, getSecret(), { ignoreExpiration: true }) as {
      sub: string
      role?: string
      email?: string
      exp?: number
    }
    if (decoded.exp && Date.now() / 1000 > decoded.exp + REFRESH_GRACE_SECONDS) {
      return null
    }
    return decoded
  } catch {
    return null
  }
}
