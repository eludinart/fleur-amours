'use client'

import { useEffect, useState } from 'react'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

/**
 * URL absolue https après montage.
 * - `path` : chemin depuis la racine de l’app (ex. `/tirage/partage/12`, `/fleur?result=3`)
 * - `null` : utiliser `window.location.href` (page courante)
 */
export function useResolvedShareUrl(path: string | null): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
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
