/**
 * Charge sync-config.env, docker-compose.env puis .env (racine repo).
 * Utilisé par dev-vps, dev:next et next.config.ts.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const WORKSPACE_ROOT = resolve(__dirname, '..')

/** @param {{ override?: boolean }} opts override=true : dernière valeur fichier gagne (dev-vps) */
export function loadRootEnv(opts = {}) {
  const { override = false } = opts
  const env = { ...process.env }
  for (const name of ['sync-config.env', 'docker-compose.env', '.env']) {
    const p = resolve(WORKSPACE_ROOT, name)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (!m) continue
      const key = m[1].trim()
      const val = m[2].trim().replace(/^["']|["']$/g, '')
      if (override || env[key] === undefined || env[key] === '') {
        env[key] = val
      }
    }
  }
  return env
}

/** Applique loadRootEnv sur process.env (sans écraser les vars déjà définies, sauf override). */
export function applyRootEnvToProcess(opts = {}) {
  const merged = loadRootEnv(opts)
  for (const [key, val] of Object.entries(merged)) {
    if (val === undefined) continue
    if (opts.override || process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val
    }
  }
}
