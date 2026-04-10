'use client'

import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { fleurApi } from '@/api/fleur'
import { fleurBetaApi } from '@/api/fleur-beta'
import { scoresToPetals } from '@/components/FlowerSVG'

/**
 * Met à jour `targetRef.current` avec les pétales normalisés de la dernière Fleur du compte,
 * pour les fusionner au payload des tirages (partage public + OG), et expose le même snapshot
 * en state pour l’aperçu fleur sur l’écran de tirage.
 */
export function useLatestFleurPetalsForShare(
  enabled: boolean,
  targetRef: MutableRefObject<Record<string, number> | null>
): Record<string, number> | null {
  const { user } = useAuth()
  const versionRef = useRef(0)
  const [basePetals, setBasePetals] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    if (!enabled || !user?.id) {
      targetRef.current = null
      setBasePetals(null)
      return
    }
    const v = ++versionRef.current
    let cancelled = false

    ;(async () => {
      try {
        const res = (await fleurApi.getMyResults()) as { items?: Array<Record<string, unknown>> }
        const items = res?.items
        if (!items?.length || cancelled || v !== versionRef.current) return
        const latest = items[0]
        let rawScores: Record<string, number> | null = null

        if (latest.type === 'duo' && latest.token) {
          const duo = (await fleurApi.getDuoResult(String(latest.token))) as Record<string, unknown>
          const a = duo?.person_a as Record<string, unknown> | undefined
          rawScores = (a?.scores as Record<string, number>) || null
        } else if (latest.type === 'fleur-beta' && latest.id != null) {
          const beta = (await fleurBetaApi.getResult(String(latest.id))) as Record<string, unknown>
          rawScores = (beta?.scores as Record<string, number>) || null
        } else if (latest.id != null) {
          const solo = (await fleurApi.getResult(String(latest.id))) as Record<string, unknown>
          rawScores = (solo?.scores as Record<string, number>) || null
        }

        if (cancelled || v !== versionRef.current) return
        if (!rawScores || !Object.keys(rawScores).length) {
          targetRef.current = null
          setBasePetals(null)
          return
        }
        const normalized = scoresToPetals(rawScores)
        const snap = Object.keys(normalized).some((k) => (normalized[k] ?? 0) > 0.02)
          ? normalized
          : null
        targetRef.current = snap
        setBasePetals(snap)
      } catch {
        if (!cancelled && v === versionRef.current) {
          targetRef.current = null
          setBasePetals(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, user?.id, targetRef])

  return basePetals
}
