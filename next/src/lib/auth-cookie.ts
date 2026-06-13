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
export const ADMIN_BACKUP_COOKIE_NAME = 'auth_token_admin_backup'

const EXPIRE_HOURS = parseInt(process.env.JWT_EXPIRE_HOURS || '720', 10)
const ADMIN_BACKUP_MAX_AGE = 24 * 3600
const IS_PROD = process.env.NODE_ENV === 'production'
const COOKIE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
/**
 * Path d'un éventuel cookie legacy à purger. D'anciennes versions ont posé
 * `auth_token` à la racine (`/`) ; un tel cookie résiduel (souvent signé avec un
 * ancien secret) est lu en priorité par le serveur et provoque des 401 en boucle
 * qu'un simple login (qui ne réécrit que `/jardin`) ne corrige pas.
 */
const LEGACY_COOKIE_PATH = COOKIE_PATH === '/' ? null : '/'

/**
 * Sérialise un en-tête Set-Cookie. On passe par `headers.append` plutôt que
 * `res.cookies.set` : ce dernier est indexé par NOM et écrase les appels précédents,
 * empêchant d'émettre plusieurs cookies `auth_token` (un par path) dans la même réponse.
 */
function serializeNamedCookie(name: string, value: string, path: string, maxAge: number): string {
  let c = `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`
  if (IS_PROD) c += '; Secure'
  return c
}

function serializeCookie(value: string, path: string, maxAge: number): string {
  return serializeNamedCookie(AUTH_COOKIE_NAME, value, path, maxAge)
}

/** Définit le cookie d'auth sur une réponse NextResponse existante. */
export function setAuthCookie(res: NextResponse, token: string): void {
  res.headers.append('Set-Cookie', serializeCookie(token, COOKIE_PATH, EXPIRE_HOURS * 3600))
  // Purge un éventuel cookie legacy à `/` qui masquerait le cookie applicatif.
  if (LEGACY_COOKIE_PATH) {
    res.headers.append('Set-Cookie', serializeCookie('', LEGACY_COOKIE_PATH, 0))
  }
}

/** Efface le cookie d'auth (maxAge = 0) sur le path applicatif ET le legacy `/`. */
export function clearAuthCookie(res: NextResponse): void {
  res.headers.append('Set-Cookie', serializeCookie('', COOKIE_PATH, 0))
  if (LEGACY_COOKIE_PATH) {
    res.headers.append('Set-Cookie', serializeCookie('', LEGACY_COOKIE_PATH, 0))
  }
}

/** Lit le token depuis le cookie de la requête entrante. */
export function getTokenFromCookie(req: NextRequest): string | null {
  return req.cookies.get(AUTH_COOKIE_NAME)?.value ?? null
}

/** Sauvegarde le JWT admin avant impersonation (httpOnly, même path que auth_token). */
export function setAdminBackupCookie(res: NextResponse, token: string): void {
  res.headers.append('Set-Cookie', serializeNamedCookie(ADMIN_BACKUP_COOKIE_NAME, token, COOKIE_PATH, ADMIN_BACKUP_MAX_AGE))
}

/** Efface le cookie de backup admin après restauration. */
export function clearAdminBackupCookie(res: NextResponse): void {
  res.headers.append('Set-Cookie', serializeNamedCookie(ADMIN_BACKUP_COOKIE_NAME, '', COOKIE_PATH, 0))
}

/** Lit le JWT admin sauvegardé depuis la requête entrante. */
export function getAdminBackupFromCookie(req: NextRequest): string | null {
  return req.cookies.get(ADMIN_BACKUP_COOKIE_NAME)?.value ?? null
}
