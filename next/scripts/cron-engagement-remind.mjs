/**
 * Cron engagement/remind pour Coolify.
 * Coolify lance la tâche dans un conteneur sans serveur HTTP sur :3000 :
 * on invoque la route Next compilée directement (pas de localhost).
 * Repli HTTP via APP_PUBLIC_URL si besoin.
 *
 * Usage : node cron-engagement-remind.mjs [--dry-run]
 */
import { access } from 'fs/promises'
import { constants } from 'fs'
import { fileURLToPath } from 'url'

const dryRun = process.argv.includes('--dry-run')
const secret = process.env.CRON_SECRET || ''
const port = process.env.PORT || '3000'

if (!secret) {
  console.error('CRON_SECRET manquant — ajoutez-le dans Coolify puis redéployez.')
  process.exit(1)
}

const payload = dryRun
  ? { dryRun: true, limit: 120, cooldownHours: 20 }
  : { limit: 120, cooldownHours: 20 }
const body = JSON.stringify(payload)

const routePath = fileURLToPath(
  new URL('./.next/server/app/api/engagement/remind/route.js', import.meta.url)
)

async function callRouteDirect() {
  await access(routePath, constants.R_OK)
  const mod = await import(routePath)
  const req = new Request('http://cron.internal/jardin/api/engagement/remind', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': secret,
    },
    body,
  })
  return mod.POST(req)
}

function resolveHttpUrl() {
  const target = process.env.CRON_TARGET_URL?.replace(/\/$/, '')
  if (target) {
    return target.includes('/api/engagement/remind') ? target : `${target}/api/engagement/remind`
  }
  const appPublic = process.env.APP_PUBLIC_URL?.replace(/\/$/, '')
  if (appPublic) return `${appPublic}/api/engagement/remind`
  return `http://127.0.0.1:${port}/jardin/api/engagement/remind`
}

async function callRouteHttp() {
  const url = resolveHttpUrl()
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': secret,
    },
    body,
  })
}

let res
try {
  res = await callRouteDirect()
  console.log('mode: direct')
} catch (directErr) {
  const hint = directErr instanceof Error ? directErr.message : String(directErr)
  console.warn(`mode direct indisponible (${hint}) — repli HTTP`)
  try {
    res = await callRouteHttp()
    console.log(`mode: http ${resolveHttpUrl()}`)
  } catch (httpErr) {
    const msg = httpErr instanceof Error ? httpErr.message : String(httpErr)
    console.error('échec HTTP :', msg)
    process.exit(1)
  }
}

const text = await res.text()
console.log(res.status, text)
if (!res.ok) process.exit(1)
