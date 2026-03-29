import jwt from 'jsonwebtoken'

const DEV_FALLBACK = 'dev-secret-change-in-production'
const rawSecret = process.env.JWT_SECRET || DEV_FALLBACK

if (rawSecret === DEV_FALLBACK && process.env.NODE_ENV === 'production') {
  throw new Error(
    '[FATAL] JWT_SECRET non défini ou égal au fallback de développement. ' +
    'Définissez une valeur forte dans les variables d\'environnement de production.'
  )
}

const SECRET = rawSecret
const EXPIRE_HOURS = parseInt(process.env.JWT_EXPIRE_HOURS || '720', 10)

export function jwtEncode(payload: { sub: string; role?: string; email?: string }): string {
  return jwt.sign(
    { ...payload, iat: Math.floor(Date.now() / 1000) },
    SECRET,
    { expiresIn: `${EXPIRE_HOURS}h` }
  )
}

export function jwtDecode(token: string): { sub: string; role?: string; email?: string } | null {
  try {
    const decoded = jwt.verify(token, SECRET) as { sub: string; role?: string; email?: string }
    return decoded
  } catch {
    return null
  }
}

/** Vérifie la signature sans rejeter les tokens expirés (pour le refresh). */
export function jwtDecodeForRefresh(token: string): { sub: string; role?: string; email?: string } | null {
  try {
    const decoded = jwt.verify(token, SECRET, { ignoreExpiration: true }) as {
      sub: string
      role?: string
      email?: string
    }
    return decoded
  } catch {
    return null
  }
}
