/**
 * Cache TTL en mémoire, côté serveur Node.js (non partagé entre workers).
 * Stocké sur globalThis pour survivre aux rechargements HMR en dev.
 * Usage : cacheGet / cacheSet / cacheDel.
 */

interface Entry<T> {
  value: T
  expiresAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __server_cache: Map<string, Entry<unknown>> | undefined
}

function getStore(): Map<string, Entry<unknown>> {
  if (!globalThis.__server_cache) {
    globalThis.__server_cache = new Map()
  }
  return globalThis.__server_cache
}

export function cacheGet<T>(key: string): T | undefined {
  const entry = getStore().get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    getStore().delete(key)
    return undefined
  }
  return entry.value as T
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  getStore().set(key, { value, expiresAt: Date.now() + ttlMs })
}

export function cacheDel(key: string): void {
  getStore().delete(key)
}

/** Supprime toutes les entrées dont la clé commence par `prefix` */
export function cacheDelPrefix(prefix: string): void {
  const store = getStore()
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
