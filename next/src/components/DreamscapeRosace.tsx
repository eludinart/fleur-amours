// @ts-nocheck
'use client'

/**
 * Rosace de cartes en HTML/CSS pur — sans WebGL/Three.js.
 * 8 cartes disposées sur un cercle parfait, responsive.
 * Utilise la technique padding-bottom pour le ratio 1:1 (compatibilité Android Chrome)
 * au lieu de aspect-ratio qui peut mal se comporter sur mobile.
 */
import { useMemo, useState, useEffect } from 'react'

const ANGLE_ORDER = [0, 45, 90, 135, 180, 225, 270, 315]
// Rayon en % du conteneur.
// Avec RADIUS_PCT=36, card 20%, scale 0.85, aspect 0.7 :
// carte droite (90°) → bord droit à 98.1% → reste dans le conteneur sur tous formats.
// Sur mobile (< 480px) : RADIUS_PCT légèrement augmenté pour mieux répartir les cartes
// (évite l'effet "entassées au centre" sur Android Chrome)
const RADIUS_PCT_DESKTOP = 36
const RADIUS_PCT_MOBILE = 40
const CARD_SCALE = 0.85

export function DreamscapeRosace({ cards = [], className = '', onCardClick, onCardHover }) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 480px)')
    const set = () => setIsMobile(mq.matches)
    set()
    mq.addEventListener('change', set)
    return () => mq.removeEventListener('change', set)
  }, [])

  const radiusPct = isMobile ? RADIUS_PCT_MOBILE : RADIUS_PCT_DESKTOP
  const items = useMemo(() => {
    return cards.slice(0, 8).map((card, i) => {
      const angleDeg = card.angleDeg ?? ANGLE_ORDER[i % 8]
      const angleRad = ((angleDeg - 90) * Math.PI) / 180
      const x = 50 + radiusPct * Math.cos(angleRad)
      const y = 50 + radiusPct * Math.sin(angleRad)
      return { ...card, angleDeg, x, y, position: card.position ?? ['Agapè','Philautia','Mania','Storgè','Pragma','Philia','Ludus','Éros'][i] }
    })
  }, [cards, radiusPct])

  return (
    <div
      className={`relative w-full min-w-[200px] aspect-square overflow-visible ${className}`.trim()}
      data-dreamscape-rosace
    >
      {/* Carré explicite (plus padding-bottom height:0) pour html2canvas / exports PNG */}
      <div className="absolute inset-0 bg-[#05030c]">
        {items.map(({ id, img, angleDeg, x, y, faceDown, cardName, halo, position }) => {
          const isClickable = !faceDown && typeof onCardClick === 'function' && cardName
          const handleClick = isClickable
            ? (e) => { e.preventDefault(); e.stopPropagation(); onCardClick({ id, cardName, faceDown }) }
            : undefined
          const handleMouseEnter = typeof onCardHover === 'function' ? () => onCardHover({ position }) : undefined
          const handleMouseLeave = typeof onCardHover === 'function' ? () => onCardHover(null) : undefined
          const haloStyle = halo === 'light'
            ? { boxShadow: '0 0 14px 4px rgba(59, 130, 246, 0.55), 0 0 22px 8px rgba(16, 185, 129, 0.4)' }
            : halo === 'shadow'
              ? { boxShadow: '0 0 14px 4px rgba(249, 115, 22, 0.55), 0 0 22px 8px rgba(239, 68, 68, 0.4)' }
              : {}
          return (
        <div
          key={id}
          role={isClickable ? 'button' : undefined}
          tabIndex={isClickable ? 0 : undefined}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(e) } } : undefined}
          onClick={handleClick}
          className={`absolute w-[20%] transition-all duration-200 rounded-lg ${isClickable ? 'cursor-pointer hover:brightness-110 hover:drop-shadow-xl focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-slate-900' : ''}`}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: `translate(-50%, -50%) rotate(${angleDeg}deg) scale(${CARD_SCALE})`,
            ...haloStyle,
          }}
          aria-label={isClickable ? cardName : undefined}
        >
          <div
            className="relative w-full rounded-md overflow-hidden bg-[#05030c] border border-violet-950/40"
            style={{ paddingBottom: '142.86%' }}
          >
            <img
              src={img}
              alt={cardName || ''}
              className="absolute inset-0 w-full h-full object-contain rounded-md shadow-lg"
              loading="lazy"
              draggable={false}
            />
          </div>
        </div>
      )})}
      </div>
    </div>
  )
}
