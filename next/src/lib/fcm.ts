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

function getServiceAccount(): { client_email?: string; private_key?: string } | null {
  // Support base64 pour éviter les problèmes de newlines dans les env vars Coolify
  const b64Val = process.env.FCM_SERVICE_ACCOUNT_B64 ?? ''
  if (b64Val) {
    try {
      const decoded = Buffer.from(b64Val, 'base64').toString('utf8')
      const parsed = JSON.parse(decoded) as { client_email?: string; private_key?: string }
      if (parsed.client_email && parsed.private_key) return parsed
    } catch {
      console.warn('[FCM] Impossible de décoder FCM_SERVICE_ACCOUNT_B64')
    }
  }

  const envVal = process.env.FCM_SERVICE_ACCOUNT_JSON ?? ''
  let json: string

  if (envVal.startsWith('{')) {
    json = envVal
  } else if (envVal) {
    const path = resolve(process.cwd(), envVal.replace(/^\.\//, ''))
    if (!existsSync(path)) {
      console.warn('[FCM] Fichier service account introuvable :', path)
      return null
    }
    try {
      json = readFileSync(path, 'utf8')
    } catch {
      return null
    }
  } else {
    const defaultPath = resolve(process.cwd(), '..', 'config', 'fcm-service-account.json')
    if (!existsSync(defaultPath)) {
      console.warn('[FCM] FCM_SERVICE_ACCOUNT_JSON non défini et config/fcm-service-account.json absent')
      return null
    }
    try {
      json = readFileSync(defaultPath, 'utf8')
    } catch {
      return null
    }
  }

  // Tentative 1 : parse direct
  try {
    const parsed = JSON.parse(json) as { client_email?: string; private_key?: string }
    if (parsed.client_email && parsed.private_key) return parsed
  } catch {
    // Tentative 2 : Coolify peut insérer de vraies newlines dans la private_key
    // On les réencapsule proprement
    try {
      const fixed = json
        // Remplace les vraies newlines DANS les valeurs de string JSON par \n
        .replace(/"private_key"\s*:\s*"([\s\S]*?)(?<!\\)"/g, (_, key: string) => {
          return `"private_key":"${key.replace(/\n/g, '\\n')}"`
        })
      const parsed = JSON.parse(fixed) as { client_email?: string; private_key?: string }
      if (parsed.client_email && parsed.private_key) return parsed
    } catch {
      /* ignore */
    }
    console.warn('[FCM] Impossible de parser FCM_SERVICE_ACCOUNT_JSON — vérifier le format dans Coolify')
    return null
  }

  console.warn('[FCM] Service account parsé mais client_email ou private_key manquant')
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
  if (!res.ok) return null
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
  const safeLink = (rel: string | null) => {
    if (!rel) return appUrl ? `${appUrl}${basePath}` : null
    if (rel.startsWith('http')) return rel
    return appUrl ? `${appUrl}${rel}` : null
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
