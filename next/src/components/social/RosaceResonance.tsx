// @ts-nocheck
'use client'

import { useId } from 'react'
import { FleurSociale } from '@/components/FleurSociale'

const PETAL_IDS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']

/**
 * Rosace de Résonance — affiche la Fleur Moyenne (8 pétales) sans données numériques.
 * petals: array of 8 values 0..1 (ordre: agape, philautia, mania, storge, pragma, philia, ludus, eros).
 * L'éclat (opacité/taille) varie selon les scores.
 */
export function RosaceResonance({ petals = [], size = 120, className = '' }) {
  const uid = useId().replace(/:/g, '')
  const normalized = Array.isArray(petals) && petals.length >= 8
    ? petals.slice(0, 8).map((v) => Math.max(0, Math.min(1, Number(v))))
    : PETAL_IDS.map(() => 0.3)
  const maxVal = Math.max(...normalized, 0.01)
  const scores = {}
  PETAL_IDS.forEach((id, i) => {
    scores[id] = Math.round((normalized[i] / maxVal) * 100)
  })

  return (
    <div className={`inline-flex flex-col items-center ${className}`} aria-hidden>
      <FleurSociale
        scores={scores}
        lastActivityAt={new Date().toISOString()}
        size={size}
        avatarEmoji={null}
        pseudo={null}
        isMe={false}
      />
    </div>
  )
}
