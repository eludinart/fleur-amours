// @ts-nocheck
'use client'

import { useEffect, useId, useState } from 'react'
import { scoresToPetals } from '@/components/FlowerSVG'
import { t } from '@/i18n'

const PETALS = [
  { id: 'agape', angle: 0 },
  { id: 'philautia', angle: 45 },
  { id: 'mania', angle: 90 },
  { id: 'storge', angle: 135 },
  { id: 'pragma', angle: 180 },
  { id: 'philia', angle: 225 },
  { id: 'ludus', angle: 270 },
  { id: 'eros', angle: 315 },
]

const MIN_LEN = 8
const MAX_LEN = 28
const PETAL_W = 8
const CENTER = 50

function petalPath(halfLen, width) {
  const tip = halfLen * 2
  return [
    `M 0 0`,
    `C ${-width * 1.1} ${-halfLen * 0.4}  ${-width * 0.8} ${-tip * 0.7}  0 ${-tip}`,
    `C ${width * 0.8}  ${-tip * 0.7}   ${width * 1.1}  ${-halfLen * 0.4}  0 0`,
    `Z`,
  ].join(' ')
}

/** Fleur sociale compacte (8 pétales) — luminosité selon last_activity_at */
export function FleurSociale({
  scores = {},
  lastActivityAt,
  size = 48,
  onClick,
  isSelected,
  avatarEmoji,
  pseudo,
  isMe = false,
  showPseudo = false,
  social = null,
  isOnline = false,
}) {
  const uid = useId().replace(/:/g, '')
  const petals = scoresToPetals(scores)
  const lastAt = lastActivityAt ? new Date(lastActivityAt).getTime() : 0
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Important: éviter Date.now() pendant le rendu (SSR + hydration) pour ne pas
  // générer d’écart de markup. On calcule un "now" stable tant que le composant
  // n'est pas monté, puis on rafraîchit après.
  const now = mounted ? Date.now() : lastAt
  const daysSince = (now - lastAt) / (24 * 60 * 60 * 1000)
  const brightness = Math.max(0.4, Math.min(1, 1.2 - daysSince * 0.15))

  const gradient = isMe
    ? { id: `fs-grad-me-${uid}`, stop1: '#fbbf24', stop2: '#d97706', stroke: '#b45309' }
    : { id: `fs-grad-${uid}`, stop1: '#34d399', stop2: '#10b981', stroke: '#10b981' }

  const sz = isMe ? Math.round(size * 1.25) : size

  return (
    <div
      className={[
        'fleur-sociale inline-flex flex-col items-center transition-transform',
        isMe ? 'relative cursor-default' : 'cursor-pointer hover:scale-[1.12]',
        isSelected ? 'rounded-full ring-2 ring-violet-400/90 shadow-[0_0_0_6px_rgba(139,92,246,0.10),0_10px_35px_rgba(2,6,23,0.35)]' : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      title={pseudo || undefined}
    >
      {isMe && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-500/90 dark:bg-amber-500/80 text-amber-950 text-[10px] font-bold whitespace-nowrap shadow-lg">
          {t('prairie.you')}
        </div>
      )}
      <svg
        viewBox="0 0 100 100"
        width={sz}
        height={sz}
        className={[
          'overflow-visible',
          isMe ? 'drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]' : '',
          !isMe && isSelected ? 'drop-shadow-[0_0_14px_rgba(167,139,250,0.55)]' : '',
          !isMe && !isSelected && isOnline ? 'drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]' : '',
        ].filter(Boolean).join(' ')}
        style={{ filter: `brightness(${brightness})` }}
      >
        <defs>
          <radialGradient id={gradient.id} cx="50%" cy="80%" r="70%">
            <stop offset="0%" stopColor={gradient.stop1} stopOpacity="0.25" />
            <stop offset="100%" stopColor={gradient.stop2} stopOpacity="0.9" />
          </radialGradient>
        </defs>
        <g transform={`translate(${CENTER}, ${CENTER})`}>
          {PETALS.map((p) => {
            const intensity = Math.max(0, Math.min(1, petals[p.id] ?? 0.3))
            const halfLen = MIN_LEN + intensity * (MAX_LEN - MIN_LEN)
            return (
              <g key={p.id} transform={`rotate(${p.angle})`}>
                <path
                  d={petalPath(halfLen, PETAL_W)}
                  fill={`url(#${gradient.id})`}
                  stroke={gradient.stroke}
                  strokeWidth={isMe ? 1.2 : 0.8}
                  strokeOpacity={0.8}
                  opacity={0.5 + intensity * 0.5}
                />
              </g>
            )
          })}
          <circle cx={0} cy={0} r={isMe ? 5 : 4} fill={isMe ? '#fef3c7' : '#fda4af'} stroke={isMe ? '#d97706' : '#f43f5e'} strokeWidth={isMe ? 1 : 0.6} />
        </g>
      </svg>
      {avatarEmoji && (
        <span className={`-mt-0.5 ${isMe ? 'text-sm' : 'text-xs'}`} aria-hidden>
          {avatarEmoji}
        </span>
      )}
      {showPseudo && pseudo && (
        <span className="mt-0.5 max-w-28 truncate text-[10px] leading-tight font-medium inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/40 dark:bg-slate-950/55 border border-white/10 text-slate-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]" title={pseudo}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-slate-400'}`} />
          {pseudo}
        </span>
      )}
      {social && ((social.rosee_received_today ?? 0) > 0 || (social.pollen_received_today ?? 0) > 0) && (
        <span className="mt-0.5 text-[10px] leading-tight text-cyan-100 dark:text-cyan-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {(social.rosee_received_today ?? 0) > 0 ? `💧${social.rosee_received_today}` : ''}{' '}
          {(social.pollen_received_today ?? 0) > 0 ? `🌸${social.pollen_received_today}` : ''}
        </span>
      )}
    </div>
  )
}
