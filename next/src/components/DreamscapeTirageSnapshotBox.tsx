// @ts-nocheck
'use client'

import { forwardRef, useCallback, useMemo } from 'react'
import { DreamscapeRosace } from '@/components/DreamscapeRosace'
import { FlowerSVG } from '@/components/FlowerSVG'
import { FLOWER_OFFSET } from '@/config/dreamscapeLayout'
import { ALL_CARDS, BACK_IMG } from '@/data/tarotCards'
import { proxyImageUrl } from '@/lib/api-client'

const FULL_SILHOUETTE_PETALS = Object.fromEntries(
  ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'].map((id) => [id, 1])
)

type Slot = {
  position: string
  card: string
  faceDown: boolean
  angleDeg: number
  revealOrder: number
  halo?: string | null
}

type DreamscapeTirageSnapshotBoxProps = {
  slots: Slot[]
  petals: Record<string, number>
  petalsDeficit?: Record<string, number>
}

/**
 * Rendu statique identique au cadre capturé sur la promenade (rosace + fleur).
 * Utilisé hors écran pour régénérer les PNG des promenades déjà sauvegardées.
 */
export const DreamscapeTirageSnapshotBox = forwardRef<HTMLDivElement, DreamscapeTirageSnapshotBoxProps>(
  function DreamscapeTirageSnapshotBox({ slots, petals, petalsDeficit = {} }, ref) {
    const cardsMap = useMemo(() => {
      const map: Record<string, (typeof ALL_CARDS)[number]> = {}
      ALL_CARDS.forEach((card) => {
        map[card.name] = card
        const norm = card.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '')
        map[norm] = card
      })
      return map
    }, [])

    const findCard = useCallback(
      (name: string | null | undefined) => {
        if (!name) return null
        if (cardsMap[name]) return cardsMap[name]
        const norm = name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '')
        if (cardsMap[norm]) return cardsMap[norm]
        return (
          Object.values(cardsMap).find((c) => {
            const cn = c.name
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]/g, '')
            return cn.includes(norm) || norm.includes(cn)
          }) ?? null
        )
      },
      [cardsMap]
    )

    const cardImageUrl = (url: string | undefined) => proxyImageUrl(url) ?? url

    const rosaceCards = useMemo(
      () =>
        slots.map((slot) => {
          const card = findCard(slot.card)
          const img = slot.faceDown ? BACK_IMG : card ? cardImageUrl(card.img) : BACK_IMG
          return {
            id: `${slot.position}:${slot.card}`,
            img,
            angleDeg: slot.angleDeg,
            faceDown: slot.faceDown,
            cardName: slot.card,
            halo: slot.halo ?? null,
            position: slot.position,
          }
        }),
      [slots, findCard]
    )

    return (
      <div
        ref={ref}
        className="relative w-[360px] h-[360px] shrink-0 overflow-hidden rounded-xl p-6 shadow-[0_0_40px_rgba(59,20,120,0.35)]"
        style={{ backgroundColor: '#05030c' }}
        data-dreamscape-snapshot
      >
        <div className="absolute inset-0 z-0 bg-[#05030c]" aria-hidden />
        <div
          className="absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(ellipse 76% 60% at 50% 46%, rgba(124,58,237,0.2) 0%, transparent 64%), linear-gradient(165deg, #07051c 0%, #120a24 50%, #05030c 100%)',
          }}
          aria-hidden
        />
        <div className="absolute inset-6 z-10 flex items-center justify-center">
          <DreamscapeRosace cards={rosaceCards} className="w-full h-full max-w-full max-h-full" />
        </div>
        <div className="absolute inset-6 pointer-events-none z-[15] flex items-center justify-center">
          <div
            className="absolute left-1/2 top-1/2"
            style={{ transform: `translate(calc(-50% + ${FLOWER_OFFSET.x}px), calc(-50% + ${FLOWER_OFFSET.y}px))` }}
          >
            <div className="absolute inset-0 flex items-center justify-center opacity-50">
              <FlowerSVG
                petals={FULL_SILHOUETTE_PETALS}
                variant="ombre"
                animate={false}
                size={240}
                showLabels={false}
                showScores={false}
              />
            </div>
            <div className="relative opacity-80">
              <FlowerSVG
                petals={petals}
                petalsDeficit={petalsDeficit}
                animate={false}
                size={240}
                showLabels={false}
                showScores={false}
                forceDualStyle={true}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }
)
