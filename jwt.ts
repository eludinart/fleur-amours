import jwt from 'jsonwebtoken'

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

/** Vérifie la signature sans rejeter les tokens expirés (pour le refresh). */
export function jwtDecodeForRefresh(token: string): { sub: string; role?: string; email?: string } | null {
  try {
    const decoded = jwt.verify(token, getSecret(), { ignoreExpiration: true }) as {
      sub: string
      role?: string
      email?: string
    }
    return decoded
  } catch {
    return null
  }
}
