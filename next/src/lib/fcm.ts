/**
 * FCM HTTP v1 — envoi de push notifications Android.
 * Utilise le compte de service Firebase (JWT + OAuth2).
 * project_id : FCM_PROJECT_ID ou lecture depuis android/app/google-services.json.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import * as jwt from 'jsonwebtoken'

function getProjectId(): string {
  const envVal = process.env.FCM_PROJECT_ID ?? ''
  if (envVal) return envVal
  const root = resolve(process.cwd(), '..')
  const paths = [
    resolve(root, 'android', 'app', 'google-services.json'),
    resolve(root, 'google-services.json'),
  ]
  for (const p of paths) {
    if (!existsSync(p)) continue
    try {
      const data = JSON.parse(readFileSync(p, 'utf8')) as { project_info?: { project_id?: string } }
      const id = data?.project_info?.project_id
      if (id) return id
    } catch {
      /* ignore */
    }
  }
  return ''
}

/** Base64 « Coolify-safe » : enlève espaces / retours à la ligne, padding, variantes URL-safe */
function decodeBase64ToUtf8(raw: string): string | null {
  let s = raw.trim().replace(/^\uFEFF/, '')
  s = s.replace(/\s+/g, '')
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4
  if (pad) s += '='.repeat(4 - pad)
  try {
    const buf = Buffer.from(s, 'base64')
    if (buf.length < 50) return null
    return buf.toString('utf8')
  } catch {
    return null
  }
}

function parseServiceAccountJsonString(json: string): { client_email?: string; private_key?: string } | null {
  let s = json.trim().replace(/^\uFEFF/, '')
  // Valeur entière = chaîne JSON échappée (une couche de plus)
  if (s.startsWith('"') && s.endsWith('"') && s.includes('\\"type\\"')) {
    try {
      s = JSON.parse(s) as string
    } catch {
      /* ignore */
    }
  }
  try {
    const parsed = JSON.parse(s) as { client_email?: string; private_key?: string }
    if (parsed.client_email && parsed.private_key) return parsed
  } catch {
    /* suite */
  }
  try {
    const fixed = s.replace(/"private_key"\s*:\s*"([\s\S]*?)(?<!\\)"/g, (_, key: string) => {
      return `"private_key":"${key.replace(/\n/g, '\\n')}"`
    })
    const parsed = JSON.parse(fixed) as { client_email?: string; private_key?: string }
    if (parsed.client_email && parsed.private_key) return parsed
  } catch {
    /* ignore */
  }
  return null
}

function getServiceAccount(): { client_email?: string; private_key?: string } | null {
  // 1) Fichier monté (secret Docker / Coolify file mount) — le plus fiable
  const filePath = (process.env.FCM_SERVICE_ACCOUNT_FILE ?? '').trim()
  if (filePath) {
    const abs = filePath.startsWith('/') ? filePath : resolve(process.cwd(), filePath)
    if (existsSync(abs)) {
      try {
        const parsed = parseServiceAccountJsonString(readFileSync(abs, 'utf8'))
        if (parsed) return parsed
      } catch {
        console.warn('[FCM] FCM_SERVICE_ACCOUNT_FILE illisible :', abs)
      }
    } else {
      console.warn('[FCM] FCM_SERVICE_ACCOUNT_FILE introuvable :', abs)
    }
  }

  // 2) Base64 (sans retours à la ligne ni espaces après normalisation)
  const b64Raw = process.env.FCM_SERVICE_ACCOUNT_B64 ?? ''
  if (b64Raw.trim()) {
    const decoded = decodeBase64ToUtf8(b64Raw)
    if (decoded) {
      const parsed = parseServiceAccountJsonString(decoded)
      if (parsed) return parsed
    }
    console.warn('[FCM] FCM_SERVICE_ACCOUNT_B64 invalide après normalisation (espaces/newlines retirés). Vérifier la copie ou utiliser FCM_SERVICE_ACCOUNT_FILE.')
  }

  // 3) JSON brut dans l’env ou chemin vers fichier
  const envVal = (process.env.FCM_SERVICE_ACCOUNT_JSON ?? '').trim()
  let json: string | null = null

  if (envVal.startsWith('{')) {
    json = envVal
  } else if (envVal) {
    const p = resolve(process.cwd(), envVal.replace(/^\.\//, ''))
    if (existsSync(p)) {
      try {
        json = readFileSync(p, 'utf8')
      } catch {
        /* ignore */
      }
    }
  }
  if (!json) {
    const defaultPath = resolve(process.cwd(), '..', 'config', 'fcm-service-account.json')
    if (existsSync(defaultPath)) {
      try {
        json = readFileSync(defaultPath, 'utf8')
      } catch {
        /* ignore */
      }
    }
  }

  if (json) {
    const parsed = parseServiceAccountJsonString(json)
    if (parsed) return parsed
    console.warn('[FCM] Impossible de parser FCM_SERVICE_ACCOUNT_JSON — préférer FCM_SERVICE_ACCOUNT_FILE ou B64 sur une seule ligne sans guillemets autour.')
    return null
  }

  console.warn('[FCM] Aucune source compte de service (FCM_SERVICE_ACCOUNT_FILE / _B64 / _JSON / config local)')
  return null
}

async function getAccessToken(): Promise<string | null> {
  const sa = getServiceAccount()
  if (!sa?.client_email || !sa?.private_key) return null

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const token = jwt.sign(payload, sa.private_key, { algorithm: 'RS256' })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token,
    }).toString(),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.warn('[FCM] OAuth2 token error', res.status, errBody.slice(0, 300))
    return null
  }
  const data = (await res.json()) as { access_token?: string }
  return data.access_token ?? null
}

export async function sendFcmPush(
  userId: number | null,
  userEmail: string | null,
  title: string,
  body: string,
  actionUrl: string | null
): Promise<number> {
  const projectId = getProjectId()
  if (!projectId) {
    console.warn('[FCM] FCM_PROJECT_ID manquant')
    return 0
  }
  const accessToken = await getAccessToken()
  if (!accessToken) {
    console.warn('[FCM] Impossible d\'obtenir un access token (service account invalide ?)')
    return 0
  }

  const { getPool, table } = await import('./db')
  const pool = getPool()
  const t = table('fleur_push_tokens')

  const [rows] = await pool.execute(
    `SELECT token, platform FROM ${t} WHERE (user_id = ? OR (user_email IS NOT NULL AND user_email = ?)) AND token IS NOT NULL AND token != ''`,
    [userId ?? 0, userEmail ?? '']
  )
  const tokenRows = ((rows ?? []) as { token: string; platform?: string }[]).filter((r) => r.token)
  if (tokenRows.length === 0) {
    console.warn(`[FCM] Aucun token pour userId=${userId} email=${userEmail}`)
    return 0
  }

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
  // Construire une URL absolue HTTPS — FCM l'exige pour webpush.fcm_options.link
  // On préfère APP_PUBLIC_URL (runtime) puis NEXT_PUBLIC_APP_URL, et on force HTTPS
  let appUrl = (process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  if (!appUrl || appUrl.includes('localhost') || appUrl.startsWith('http://')) {
    // Fallback : construire depuis l'hôte de production connu
    const host = process.env.APP_HOST ?? process.env.VIRTUAL_HOST ?? ''
    appUrl = host ? `https://${host}` : ''
  }
  /** Chemins en DB (ex. /clairiere/5) n'incluent pas toujours basePath (/jardin). */
  const withBasePath = (rel: string | null): string => {
    const bp = basePath.replace(/\/$/, '')
    if (!rel || rel === '/') return bp
    if (rel.startsWith('http')) return rel
    const r = rel.startsWith('/') ? rel : `/${rel}`
    if (r === bp || r.startsWith(`${bp}/`)) return r
    return `${bp}${r}`
  }
  const safeLink = (rel: string | null) => {
    if (!appUrl) return null
    return `${appUrl}${withBasePath(rel)}`
  }
  const link = safeLink(actionUrl)
  const icon = appUrl ? `${appUrl}${basePath}/juste-la-fleur.png` : `${basePath}/juste-la-fleur.png`

  console.log(`[FCM] Envoi à ${tokenRows.length} token(s), appUrl=${appUrl}, link=${link}`)

  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`
  let sent = 0
  for (const { token, platform } of tokenRows) {
    // Tous les tokens enregistrés via le navigateur sont de type web,
    // même si platform='android' par défaut (ancien schéma)
    const isWebToken = platform === 'web' || platform == null || platform === 'android'
    const message: Record<string, unknown> = {
      token,
      notification: { title, body },
      data: { action_url: actionUrl ?? '' },
    }
    // Bloc webpush : toujours présent pour les tokens FCM web (PWA)
    const webpushBlock: Record<string, unknown> = {
      headers: { Urgency: 'high' },
      notification: {
        title,
        body,
        icon,
        badge: icon,
        requireInteraction: false,
        tag: 'fleur-message',
        renotify: true,
      },
    }
    if (link) webpushBlock.fcm_options = { link }
    if (isWebToken) message.webpush = webpushBlock
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    })
    if (res.ok) {
      const data = (await res.json()) as { error?: unknown }
      if (!data.error) {
        sent++
      } else {
        console.warn('[FCM] Erreur réponse token', token.slice(0, 20), data.error)
      }
    } else {
      const errText = await res.text().catch(() => '')
      console.warn('[FCM] HTTP error', res.status, token.slice(0, 20), errText.slice(0, 200))
    }
  }
  return sent
}
