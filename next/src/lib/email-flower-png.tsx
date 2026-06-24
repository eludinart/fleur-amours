/**
 * Rendu PNG de la fleur personnalisée pour e-mails (CID embarqué).
 */
import React from 'react'
import { ImageResponse } from 'next/og'
import { dominantPetalFromScores, normalizePetalsForEmail } from './email-flower-svg'
import { OgFlowerGraphic } from './og-flower-graphic'

/** Taille affichée dans le mail (attribut width/height). */
export const EMAIL_FLOWER_DISPLAY_SIZE = 280
/** Taille du PNG généré (2× pour netteté sur écrans retina). */
const PNG_SIZE = EMAIL_FLOWER_DISPLAY_SIZE
/** Rosace : center = size pour centrer le viewBox sur l'origine (0,0). */
const GRAPHIC_SIZE = 248

export async function renderEmailFlowerPng(scores: Record<string, number>): Promise<Buffer> {
  const normalized = normalizePetalsForEmail(scores)
  const dominant = dominantPetalFromScores(normalized)?.id ?? null

  const res = new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: PNG_SIZE,
          height: PNG_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 55%, #fff5f7 0%, #ffffff 72%)',
        }}
      >
        <OgFlowerGraphic
          scores={normalized}
          dominant={dominant}
          size={GRAPHIC_SIZE}
          center={GRAPHIC_SIZE}
          minLen={22}
          maxLen={88}
          petalWidth={24}
        />
      </div>
    ),
    { width: PNG_SIZE, height: PNG_SIZE }
  )

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
