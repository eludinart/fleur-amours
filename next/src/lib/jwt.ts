import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
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
