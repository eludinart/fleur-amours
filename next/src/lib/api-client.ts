/** basePath Next.js — doit correspondre à next.config.ts */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

/**
 * Client HTTP centralisé avec refresh automatique du token JWT.
 * Adapté pour Next.js (NEXT_PUBLIC_* au lieu de VITE_*).
 */
function getBase(): string {
  if (typeof window === 'undefined') return ''
  // En localhost, toujours utiliser l'API locale (évite cache/external)
  if (typeof window !== 'undefined' && /^https?:\/\/localhost(:\d+)?$/.test(window.location.origin)) {
    return `${window.location.origin}${BASE_PATH}`
  }
  const envUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
  if (envUrl && envUrl.trim() !== '') return envUrl
  return `${window.location.origin}${BASE_PATH}`
}

let _requestLocale: string | null = null

export function setLocaleForRequests(locale: string | null) {
  _requestLocale = locale || null
}

export function getAuthToken(): string | null {
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

let _refreshPromise: Promise<string | null> | null = null

async function _tryRefreshToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise
  _refreshPromise = (async () => {
    const token = getAuthToken()
    if (!token) return null
    try {
      const res = await fetch(`${getBase()}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) return null
      const data = await res.json()
      const newToken = data?.token
      if (newToken && typeof window !== 'undefined') {
        localStorage.setItem('auth_token', newToken)
        return newToken
      }
      return null
    } catch {
      return null
    } finally {
      _refreshPromise = null
    }
  })()
  return _refreshPromise
}

async function request(
  path: string,
  options: RequestInit & { headers?: Record<string, string> } = {},
  _isRetry = false,
  _tokenOverride: string | null = null
): Promise<unknown> {
  const base = getBase()
  const url = path.startsWith('http') ? path : `${base}${path}`
  const token = _tokenOverride ?? getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (_requestLocale) headers['X-Locale'] = _requestLocale

  let res: Response
  try {
    res = await fetch(url, { ...options, headers })
  } catch (networkErr) {
    const msg = base
      ? `Impossible de joindre le serveur (${url}). Vérifiez votre connexion.`
      : 'Impossible de joindre le serveur. Vérifiez votre connexion.'
    throw new ApiError(0, msg, String(networkErr))
  }

  if (
    res.status === 401 &&
    !_isRetry &&
    !path.includes('/auth/login') &&
    !path.includes('/auth/refresh') &&
    !path.includes('/auth/register')
  ) {
    const newToken = await _tryRefreshToken()
    if (newToken) return request(path, options, true, newToken)
    if (typeof window !== 'undefined') {
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
    throw new ApiError(res.status, detail, raw, errorCode)
  }

  if (res.status === 204) return null
  const text = await res.text()
  if (!text?.trim()) throw new ApiError(res.status, 'Réponse vide du serveur.', text)
  try {
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
