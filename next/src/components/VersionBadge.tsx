'use client'

import { useEffect, useState } from 'react'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

/**
 * Badge version :
 * - Legacy (prod) : v0.1.0 · a1b2c3d (version incrémentée manuellement + commit Git)
 * - Dev : v0.1.0 · dev (version depuis version.json)
 */
export function VersionBadge() {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    // Prod : build-info.json (version + commit)
    fetch(`${basePath}/build-info.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { version?: string; commit?: string } | null) => {
        if (data?.version) {
          const commit = data.commit && data.commit !== 'unknown' ? data.commit : null
          setLabel(commit ? `v${data.version} · ${commit}` : `v${data.version}`)
        } else {
          throw new Error('fallback')
        }
      })
      .catch(() => {
        // Dev : version.json seul
        fetch(`${basePath}/version.json`, { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .then((data: { version?: string } | null) => {
            setLabel(data?.version ? `v${data.version} · dev` : 'dev')
          })
          .catch(() => setLabel('dev'))
      })
  }, [])

  if (!label) return null

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300"
      title={label.includes('dev') ? 'Environnement local' : `Version déployée: ${label}`}
    >
      {label}
    </span>
  )
}
