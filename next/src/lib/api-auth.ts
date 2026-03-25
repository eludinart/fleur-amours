/**
 * Helpers pour les routes API (JWT, user_id).
 */
import { NextRequest } from 'next/server'
import { jwtDecode, jwtDecodeForRefresh } from './jwt'
import { authMe } from './db-auth'

export function getAuthHeader(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

function decodeToken(token: string) {
  return jwtDecode(token) ?? jwtDecodeForRefresh(token)
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

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}
