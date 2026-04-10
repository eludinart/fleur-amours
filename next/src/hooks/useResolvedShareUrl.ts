'use client'

import { useEffect, useState } from 'react'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

/**
 * URL absolue après montage.
 * - `path` : chemin depuis la racine de l’app (ex. `/tirage/partage/12`, `/fleur?result=3`)
 * - `null` : `window.location.href` (page courante)
 * - `false` : pas d’URL dédiée (chaîne vide)
 */
export function useResolvedShareUrl(path: string | null | false): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (path === false) {
      setUrl('')
      return
    }
    if (path == null) {
      setUrl(window.location.href)
      return
    }
    const base = `${window.location.origin}${basePath}`.replace(/\/+$/, '')
    const p = path.startsWith('/') ? path : `/${path}`
    setUrl(`${base}${p}`)
  }, [path])
  return url
}
