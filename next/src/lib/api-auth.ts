/**
 * Helpers pour les routes API (JWT, user_id).
 *
 * Priorité de lecture du token :
 *   1. Header `Authorization: Bearer` (explicite — sortie d'impersonation, Capacitor)
 *   2. Cookie httpOnly `auth_token` (navigateurs web par défaut)
 */
import { NextRequest } from 'next/server'
import { jwtDecode } from './jwt'
import { authMe } from './db-auth'
import { getTokenFromCookie } from './auth-cookie'

export function getAuthHeader(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  const cookieToken = getTokenFromCookie(req)
  if (cookieToken) return cookieToken
  return null
}

/**
 * Décodage strict : un token expiré est rejeté (401).
 * Le décodage tolérant (`jwtDecodeForRefresh`) est réservé à /api/auth/refresh.
 */
function decodeToken(token: string) {
  return jwtDecode(token)
}

export function getUserIdFromRequest(req: NextRequest): string | null {
  const token = getAuthHeader(req)
  if (!token) return null
  const payload = decodeToken(token)
  if (!payload?.sub) return null
  return String(payload.sub)
}

export async function requireAuth(req: NextRequest): Promise<{ userId: string }> {
  const userId = getUserIdFromRequest(req)
  if (!userId) {
    throw new ApiError(401, 'Authentification requise')
  }
  return { userId }
}

export async function requireAdmin(req: NextRequest): Promise<{ userId: string }> {
  const token = getAuthHeader(req)
  if (!token) throw new ApiError(401, 'Authentification requise')
  const payload = decodeToken(token)
  if (!payload?.sub) throw new ApiError(401, 'Token invalide')
  const userId = String(payload.sub)

  const role = (payload.role as string) ?? ''
  if (role === 'admin' || role === 'administrator') {
    return { userId }
  }

  // Vérifier en base si le rôle a été mis à jour (ex. admin accordé après le login)
  try {
    const user = await authMe(parseInt(userId, 10))
    const dbRole = user.app_role || user.wp_role || ''
    if (dbRole === 'admin' || dbRole === 'administrator') {
      return { userId }
    }
  } catch {
    // authMe échoue (DB non dispo, user inexistant) → on garde le rejet
  }

  throw new ApiError(403, 'Accès administrateur requis')
}

export async function requireAdminOrCoach(req: NextRequest): Promise<{ userId: string; isAdmin: boolean; isCoach: boolean }> {
  const token = getAuthHeader(req)
  if (!token) throw new ApiError(401, 'Authentification requise')
  const payload = decodeToken(token)
  if (!payload?.sub) throw new ApiError(401, 'Token invalide')
  const userId = String(payload.sub)

  const role = (payload.role as string) ?? ''
  if (role === 'admin' || role === 'administrator') {
    return { userId, isAdmin: true, isCoach: true }
  }
  if (role === 'coach') {
    return { userId, isAdmin: false, isCoach: true }
  }

  try {
    const user = await authMe(parseInt(userId, 10))
    const dbRole = user.app_role || user.wp_role || ''
    if (dbRole === 'admin' || dbRole === 'administrator') {
      return { userId, isAdmin: true, isCoach: true }
    }
    if (dbRole === 'coach') {
      return { userId, isAdmin: false, isCoach: true }
    }
  } catch {
    // authMe échoue
  }

  throw new ApiError(403, 'Accès coach ou administrateur requis')
}

/**
 * Accès Mycelium (entreprise) : rôles `manager` ou `rh` (ou admin, qui couvre tout).
 * La source de vérité de l'appartenance organisation/équipe reste la table
 * `fleur_memberships` ; ce helper ne contrôle que le rôle global.
 */
export async function requireManagerOrRh(
  req: NextRequest
): Promise<{ userId: string; isAdmin: boolean; isManager: boolean; isRh: boolean }> {
  const token = getAuthHeader(req)
  if (!token) throw new ApiError(401, 'Authentification requise')
  const payload = decodeToken(token)
  if (!payload?.sub) throw new ApiError(401, 'Token invalide')
  const userId = String(payload.sub)

  const role = (payload.role as string) ?? ''
  if (role === 'admin' || role === 'administrator') {
    return { userId, isAdmin: true, isManager: true, isRh: true }
  }
  if (role === 'manager') return { userId, isAdmin: false, isManager: true, isRh: false }
  if (role === 'rh') return { userId, isAdmin: false, isManager: false, isRh: true }

  try {
    const user = await authMe(parseInt(userId, 10))
    const dbRole = user.app_role || user.wp_role || ''
    if (dbRole === 'admin' || dbRole === 'administrator') {
      return { userId, isAdmin: true, isManager: true, isRh: true }
    }
    if (dbRole === 'manager') return { userId, isAdmin: false, isManager: true, isRh: false }
    if (dbRole === 'rh') return { userId, isAdmin: false, isManager: false, isRh: true }
  } catch {
    // authMe échoue (DB non dispo, user inexistant) → on garde le rejet
  }

  throw new ApiError(403, 'Accès manager ou RH requis')
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}
