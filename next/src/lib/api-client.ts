/** basePath Next.js — doit correspondre à next.config.ts */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

/**
 * Client HTTP centralisé avec refresh automatique du token JWT.
 *
 * Stratégie d'authentification :
 *   - Navigateur web  : cookie httpOnly `auth_token` (envoyé via `credentials: 'include'`).
 *                        Aucun token dans localStorage — protection XSS.
 *   - Capacitor/Android : localStorage + `Authorization: Bearer` (cookie cross-origin non dispo).
 *
 * Détection Capacitor : `window.Capacitor` défini à l'exécution.
 */

function getBase(): string {
  if (typeof window === 'undefined') return ''
  if (/^https?:\/\/localhost(:\d+)?$/.test(window.location.origin)) {
    return `${window.location.origin}${BASE_PATH}`
  }
  const envUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
  if (envUrl && envUrl.trim() !== '') return envUrl
  return `${window.location.origin}${BASE_PATH}`
}

/** Même origine que `api.*` (ex. sur localhost, toujours `/jardin` même si NEXT_PUBLIC_API_URL est défini sans basePath). */
export function getResolvedApiBase(): string {
  return getBase()
}

/** Retourne true si le code s'exécute dans une WebView Capacitor. */
export function isCapacitor(): boolean {
  return typeof window !== 'undefined' &&
    !!(window as Window & { Capacitor?: unknown }).Capacitor
}

let _requestLocale: string | null = null

export function setLocaleForRequests(locale: string | null) {
  _requestLocale = locale || null
}

/**
 * Retourne le token JWT depuis localStorage.
 * Uniquement pour Capacitor — sur navigateur web, on renvoie null
 * (le cookie httpOnly est géré automatiquement par le navigateur).
 */
export function getAuthToken(): string | null {
  if (!isCapacitor()) return null
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

export class ApiError extends Error {
  status: number
  detail: string
  raw: string
  code: string | null
  response: { data: { detail: string } }

  constructor(status: number, detail: string, raw = '', code: string | null = null) {
    super(detail || `Erreur ${status}`)
    this.status = status
    this.detail = detail
    this.raw = raw
    this.code = code
    this.response = { data: { detail } }
  }
}

let _refreshPromise: Promise<boolean> | null = null

/**
 * Tente de rafraîchir la session.
 *   - Web      : envoie le cookie via `credentials: 'include'`, récupère le nouveau cookie.
 *   - Capacitor: envoie le Bearer token, stocke le nouveau token en localStorage.
 * Retourne true si le refresh a réussi.
 */
async function _tryRefreshToken(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise
  _refreshPromise = (async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const token = getAuthToken() // null sur web, token localStorage sur Capacitor
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${getBase()}/api/auth/refresh`, {
        method: 'POST',
        headers,
        credentials: 'include',
      })
      if (!res.ok) return false

      if (isCapacitor()) {
        // Sur Capacitor, sauvegarder le nouveau token dans localStorage
        const data = await res.json().catch(() => ({}))
        const newToken = data?.token
        if (newToken && typeof window !== 'undefined') {
          localStorage.setItem('auth_token', newToken)
        }
      }
      return true
    } catch {
      return false
    } finally {
      _refreshPromise = null
    }
  })()
  return _refreshPromise
}

async function request(
  path: string,
  options: RequestInit & { headers?: Record<string, string> } = {},
  _isRetry = false
): Promise<unknown> {
  const base = getBase()
  const url = path.startsWith('http') ? path : `${base}${path}`
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()

  // Best-effort telemetry (client only, avoid hard dependency)
  const traceId =
    typeof window !== 'undefined' && typeof crypto !== 'undefined' && 'getRandomValues' in crypto
      ? (() => {
          const bytes = new Uint8Array(8)
          crypto.getRandomValues(bytes)
          return `t_${Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')}`
        })()
      : null
  if (typeof window !== 'undefined') {
    void import('@/lib/telemetry/client')
      .then(({ track }) => {
        track({
          name: 'api_request',
          feature: 'api',
          path,
          trace_id: traceId ?? undefined,
          properties: {
            path,
            url,
            method: (options.method || 'GET').toUpperCase(),
          },
        })
      })
      .catch(() => {})
  }

  // Sur Capacitor, ajouter Authorization: Bearer si token disponible
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (_requestLocale) headers['X-Locale'] = _requestLocale
  if (traceId) headers['X-Trace-Id'] = traceId

  let res: Response
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // envoie le cookie httpOnly sur web + cookies Capacitor
    })
  } catch (networkErr) {
    const msg = base
      ? `Impossible de joindre le serveur (${url}). Vérifiez votre connexion.`
      : 'Impossible de joindre le serveur. Vérifiez votre connexion.'
    if (typeof window !== 'undefined') {
      const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
      void import('@/lib/telemetry/client')
        .then(({ track }) => {
          track({
            name: 'api_error',
            feature: 'api',
            path,
            trace_id: traceId ?? undefined,
            properties: {
              path,
              url,
              method: (options.method || 'GET').toUpperCase(),
              status: 0,
              duration_ms: Math.round(durationMs),
              kind: 'network',
            },
          })
        })
        .catch(() => {})
    }
    throw new ApiError(0, msg, String(networkErr))
  }

  if (
    res.status === 401 &&
    !_isRetry &&
    !path.includes('/auth/login') &&
    !path.includes('/auth/refresh') &&
    !path.includes('/auth/register')
  ) {
    const refreshed = await _tryRefreshToken()
    if (refreshed) return request(path, options, true)
    // Refresh échoué : sur Capacitor, le token localStorage est la source de vérité → nettoyer.
    // Sur web, le cookie httpOnly est géré par le serveur → ne pas toucher localStorage
    // pour éviter de déconnecter l'utilisateur à cause d'une erreur réseau transitoire.
    if (isCapacitor() && typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }
    throw new ApiError(401, 'Session expirée, veuillez vous reconnecter.')
  }

  if (!res.ok) {
    let detail = `Erreur ${res.status}`
    let raw = ''
    let errorCode: string | null = null
    try {
      raw = await res.text()
      const json = JSON.parse(raw)
      if (json.detail) {
        detail = Array.isArray(json.detail)
          ? json.detail.map((e: { msg?: string }) => e.msg ?? String(e)).join(', ')
          : String(json.detail)
      } else if (json.error) {
        detail = String(json.error)
      }
      if (json.code) errorCode = json.code
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
      void import('@/lib/telemetry/client')
        .then(({ track }) => {
          track({
            name: 'api_error',
            feature: 'api',
            path,
            trace_id: traceId ?? undefined,
            properties: {
              path,
              url,
              method: (options.method || 'GET').toUpperCase(),
              status: res.status,
              duration_ms: Math.round(durationMs),
              code: errorCode,
              detail,
            },
          })
        })
        .catch(() => {})
    }
    throw new ApiError(res.status, detail, raw, errorCode)
  }

  if (res.status === 204) return null
  const text = await res.text()
  if (!text?.trim()) throw new ApiError(res.status, 'Réponse vide du serveur.', text)
  try {
    if (typeof window !== 'undefined') {
      const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
      void import('@/lib/telemetry/client')
        .then(({ track }) => {
          track({
            name: 'api_response',
            feature: 'api',
            path,
            trace_id: traceId ?? undefined,
            properties: {
              path,
              url,
              method: (options.method || 'GET').toUpperCase(),
              status: res.status,
              duration_ms: Math.round(durationMs),
            },
          })
        })
        .catch(() => {})
    }
    return JSON.parse(text)
  } catch {
    const preview = text.length > 200 ? `${text.slice(0, 200)}…` : text
    const hint = text.trimStart().startsWith('<')
      ? ' Le serveur a renvoyé du HTML (erreur, 404 ou page par défaut).'
      : ''
    throw new ApiError(
      res.status,
      `Réponse invalide (non-JSON).${hint} Aperçu : ${preview}`,
      text
    )
  }
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body: unknown = {}) =>
    request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    request(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) =>
    request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
}

export function cardImageUrl(imageFile: string | null | undefined): string | null {
  if (!imageFile) return null
  const base = process.env.NEXT_PUBLIC_MEDIA_URL ?? BASE_PATH ?? ''
  return `${base}/cartes/${imageFile}`
}

/** Base URL pour les requêtes API (client-safe, gère SSR). */
function getApiBase(): string {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_API_URL ?? ''
  const envUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
  if (envUrl?.trim()) return envUrl
  return `${typeof window !== 'undefined' ? window.location.origin : ''}${BASE_PATH}`
}

/** URL de l'image via le proxy (pour URLs externes). */
export function proxyImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return url ?? null
  if (url.startsWith('/') || url.startsWith('data:')) return url
  const base = getApiBase()
  return `${base}/api/proxy-image?url=${encodeURIComponent(url)}`
}

export async function translateText(
  text: string,
  target: string,
  source = 'auto'
): Promise<string> {
  const data = (await api.post('/api/translate', {
    text,
    target,
    source,
  })) as { translatedText?: string }
  return data?.translatedText ?? ''
}
