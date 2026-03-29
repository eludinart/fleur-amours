/**
 * Helpers pour le cookie d'authentification httpOnly.
 *
 * - httpOnly   : inaccessible au JavaScript côté client (protection XSS)
 * - SameSite=Lax : les requêtes POST cross-origin ne reçoivent pas le cookie (protection CSRF)
 *                  mais les navigations GET (ex. lien email) l'incluent
 * - Secure     : HTTPS uniquement en production
 * - Path       : /jardin (basePath de l'application)
 *
 * Capacitor / Android standalone : les requêtes partent de l'origine capacitor://localhost,
 * donc le cookie cross-origin n'est pas envoyé automatiquement.
 * Ces clients continuent d'utiliser Authorization: Bearer (fallback dans api-auth.ts).
 */
import type { NextRequest, NextResponse } from 'next/server'

export const AUTH_COOKIE_NAME = 'auth_token'

const EXPIRE_HOURS = parseInt(process.env.JWT_EXPIRE_HOURS || '720', 10)
const IS_PROD = process.env.NODE_ENV === 'production'
const COOKIE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

/** Définit le cookie d'auth sur une réponse NextResponse existante. */
export function setAuthCookie(res: NextResponse, token: string): void {
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    path: COOKIE_PATH,
    maxAge: EXPIRE_HOURS * 3600,
  })
}

/** Efface le cookie d'auth (maxAge = 0). */
export function clearAuthCookie(res: NextResponse): void {
  res.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    path: COOKIE_PATH,
    maxAge: 0,
  })
}

/** Lit le token depuis le cookie de la requête entrante. */
export function getTokenFromCookie(req: NextRequest): string | null {
  return req.cookies.get(AUTH_COOKIE_NAME)?.value ?? null
}
