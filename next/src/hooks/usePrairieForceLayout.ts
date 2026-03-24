// @ts-nocheck
'use client'

import { useMemo, useState, useEffect } from 'react'

/**
 * Layout pour la Prairie : positions déterministes sans chevauchement.
 * - me_fleur au centre (0.5, 0.5)
 * - Autres fleurs sur des cercles concentriques, espacement minimal garanti (STEP = 0.12)
 */
const STEP = 0.12

export function usePrairieForceLayout(fleurs, meFleur, links) {
  const [positions, setPositions] = useState(() => ({}))
  const [settled, setSettled] = useState(false)

  const nodeIds = useMemo(() => {
    const ids = new Set()
    const add = (id) => { if (id != null && id !== '') ids.add(Number(id)) }
    if (meFleur?.user_id != null) add(meFleur.user_id)
    fleurs.forEach((f) => ids.add(f.user_id))
    return ids
  }, [fleurs, meFleur])

  useEffect(() => {
    const nodes = [...nodeIds].sort((a, b) => a - b)
    if (nodes.length === 0) {
      setPositions({})
      setSettled(true)
      return
    }

    const meId = meFleur?.user_id != null ? Number(meFleur.user_id) : null
    const others = nodes.filter((id) => id !== meId)

    const pos = {}
    if (meId != null) pos[meId] = { x: 0.5, y: 0.5 }

    others.forEach((id, i) => {
      const n = others.length
      const ring = Math.floor(Math.sqrt(i))
      const perRing = ring === 0 ? 1 : Math.max(1, ring * 6)
      const idxInRing = ring === 0 ? 0 : i - ring * ring
      const angle = (idxInRing / perRing) * 2 * Math.PI + (id * 0.382)
      const r = 0.1 + ring * STEP
      pos[id] = {
        x: Math.max(0.12, Math.min(0.88, 0.5 + r * Math.cos(angle))),
        y: Math.max(0.12, Math.min(0.88, 0.5 + r * Math.sin(angle))),
      }
    })

    setPositions(pos)
    setSettled(true)
  }, [fleurs, meFleur, nodeIds])

  return { positions, settled }
}
