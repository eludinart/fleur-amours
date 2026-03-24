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
  const envVal = process.env.FCM_SERVICE_ACCOUNT_JSON ?? ''
  let json: string
  if (envVal.startsWith('{')) {
    json = envVal
  } else if (envVal) {
    const path = resolve(process.cwd(), envVal.replace(/^\.\//, ''))
    if (!existsSync(path)) return null
    try {
      json = readFileSync(path, 'utf8')
    } catch {
      return null
    }
  } else {
    const defaultPath = resolve(process.cwd(), '..', 'config', 'fcm-service-account.json')
    if (!existsSync(defaultPath)) return null
    try {
      json = readFileSync(defaultPath, 'utf8')
    } catch {
      return null
    }
  }
  try {
    return JSON.parse(json) as { client_email?: string; private_key?: string }
  } catch {
    return null
  }
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
  if (!projectId) return 0
  const accessToken = await getAccessToken()
  if (!accessToken) return 0

  const { getPool, table } = await import('./db')
  const pool = getPool()
  const t = table('fleur_push_tokens')

  const [rows] = await pool.execute(
    `SELECT token FROM ${t} WHERE (user_id = ? OR (user_email IS NOT NULL AND user_email = ?)) AND token IS NOT NULL AND token != ''`,
    [userId ?? 0, userEmail ?? '']
  )
  const tokens = ((rows ?? []) as { token: string }[]).map((r) => r.token).filter(Boolean)
  if (tokens.length === 0) return 0

  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`
  let sent = 0
  for (const token of tokens) {
    const message = {
      token,
      notification: { title, body },
      data: { action_url: actionUrl ?? '' },
      android: {
        notification: { channel_id: 'fleur_default' },
      },
    }
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
      if (!data.error) sent++
    }
  }
  return sent
}
