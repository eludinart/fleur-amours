'use client'

import { useEffect, useId, useState } from 'react'
import { scoresToPetals } from '@/components/FlowerSVG'
import { FLOWER_PERSON_GRADIENT, PETAL_BY_ID } from '@/lib/petal-theme'
import { dominantPetalId } from '@/lib/petal-tarot'
import { t } from '@/i18n'

export type FleurSocialeProps = {
  scores?: Record<string, number>
  lastActivityAt?: string | null
  size?: number
  onClick?: () => void
  isSelected?: boolean
  avatarEmoji?: string
  pseudo?: string
  isMe?: boolean
  showPseudo?: boolean
  social?: {
    rosee_received_today?: number
    pollen_received_today?: number
    rosee_received_total?: number
    pollen_received_total?: number
  } | null
  isOnline?: boolean
  variant?: 'compact' | 'portrait'
}

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

function petalPath(halfLen: number, width: number): string {
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
  variant = 'compact',
}: FleurSocialeProps) {
  const uid = useId().replace(/:/g, '')
  const petals = scoresToPetals(scores)
  const pulseId = isMe ? dominantPetalId(petals) : null
  const dominantId = dominantPetalId(petals) || 'agape'
  const dominantColor = PETAL_BY_ID[dominantId]?.color ?? '#34d399'
  const isPortrait = variant === 'portrait'
  const lastAt = lastActivityAt ? new Date(lastActivityAt).getTime() : 0
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const now = mounted ? Date.now() : lastAt
  const daysSince = (now - lastAt) / (24 * 60 * 60 * 1000)
  const brightness = isPortrait
    ? Math.max(0.92, Math.min(1.08, 1.06 - daysSince * 0.03))
    : Math.max(0.4, Math.min(1, 1.2 - daysSince * 0.15))

  const gradient = isMe
    ? { id: `fs-grad-me-${uid}`, stop1: '#fbbf24', stop2: '#d97706', stroke: '#b45309' }
    : { id: `fs-grad-${uid}`, stop1: '#34d399', stop2: '#10b981', stroke: '#10b981' }

  const sz = isMe ? Math.round(size * 1.25) : size
  const minLen = isPortrait ? 14 : MIN_LEN
  const maxLen = isPortrait ? (size >= 100 ? 36 : 32) : MAX_LEN
  const petalW = isPortrait ? (size >= 100 ? 11 : 9.5) : PETAL_W
  const showEmojiBelow = avatarEmoji && !(isPortrait && size >= 96)

  const portraitGlow = isPortrait
    ? `drop-shadow(0 0 ${size >= 100 ? 28 : 18}px ${dominantColor}88) drop-shadow(0 0 ${size >= 100 ? 48 : 32}px ${dominantColor}44)`
    : ''

  return (
    <div
      className={[
        'fleur-sociale inline-flex flex-col items-center transition-transform',
        isPortrait ? 'relative' : '',
        isMe ? 'relative cursor-default' : 'cursor-pointer hover:scale-[1.12]',
        isSelected ? 'rounded-full ring-2 ring-violet-400/90 shadow-[0_0_0_6px_rgba(139,92,246,0.10),0_10px_35px_rgba(2,6,23,0.35)]' : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      title={pseudo || undefined}
    >
      {isPortrait && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: sz * 1.35,
            height: sz * 1.35,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -52%)',
            background: `radial-gradient(circle, ${dominantColor}55 0%, ${dominantColor}22 42%, transparent 72%)`,
            filter: 'blur(10px)',
          }}
          aria-hidden
        />
      )}
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
          'overflow-visible relative z-[1]',
          isPortrait ? 'animate-[fleur-portrait-breathe_4s_ease-in-out_infinite]' : '',
          isMe ? 'drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]' : '',
          !isMe && isSelected ? 'drop-shadow-[0_0_14px_rgba(167,139,250,0.55)]' : '',
          !isMe && !isSelected && isOnline && !isPortrait ? 'drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]' : '',
        ].filter(Boolean).join(' ')}
        style={{
          filter: [
            portraitGlow,
            `brightness(${brightness})`,
            isPortrait ? 'saturate(1.18)' : '',
          ].filter(Boolean).join(' '),
        }}
      >
        <defs>
          <radialGradient id={gradient.id} cx="50%" cy="80%" r="70%">
            <stop offset="0%" stopColor={gradient.stop1} stopOpacity={isPortrait ? 0.45 : 0.25} />
            <stop offset="100%" stopColor={gradient.stop2} stopOpacity={isPortrait ? 1 : 0.9} />
          </radialGradient>
          {isPortrait && (
            <radialGradient id={`fs-core-${uid}`} cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="55%" stopColor="#fecdd3" />
              <stop offset="100%" stopColor="#fb7185" />
            </radialGradient>
          )}
        </defs>
        <g transform={`translate(${CENTER}, ${CENTER})`}>
          {PETALS.map((p) => {
            const intensity = Math.max(isPortrait ? 0.22 : 0, Math.min(1, petals[p.id] ?? (isPortrait ? 0.35 : 0.3)))
            const halfLen = minLen + intensity * (maxLen - minLen)
            const petalDef = PETAL_BY_ID[p.id]
            const petalFill = isPortrait ? (petalDef?.color ?? '#34d399') : `url(#${gradient.id})`
            const petalStroke = isPortrait ? (petalDef?.color ?? '#10b981') : gradient.stroke
            return (
              <g key={p.id} transform={`rotate(${p.angle})`}>
                <g>
                  {pulseId === p.id ? (
                    <animateTransform
                      attributeName="transform"
                      attributeType="XML"
                      type="scale"
                      values="1;1.02;1"
                      keyTimes="0;0.5;1"
                      dur="3.2s"
                      repeatCount="indefinite"
                    />
                  ) : null}
                  {isPortrait && (
                    <path
                      d={petalPath(halfLen * 1.04, petalW * 1.08)}
                      fill={petalFill}
                      stroke={petalStroke}
                      strokeWidth={1.1}
                      strokeOpacity={0.35}
                      opacity={0.28 + intensity * 0.22}
                      transform="translate(1.2, 1.5)"
                    />
                  )}
                  <path
                    d={petalPath(halfLen, petalW)}
                    fill={petalFill}
                    stroke={petalStroke}
                    strokeWidth={isPortrait ? 1.1 : (isMe ? 1.2 : 0.8)}
                    strokeOpacity={isPortrait ? 0.75 : 0.8}
                    opacity={isPortrait ? 0.78 + intensity * 0.22 : 0.5 + intensity * 0.5}
                  />
                  {isPortrait && (
                    <path
                      d={petalPath(halfLen * 0.55, petalW * 0.28)}
                      fill="#ffffff"
                      stroke="none"
                      opacity={0.12 + intensity * 0.18}
                      transform={`translate(0, ${-halfLen * 0.18})`}
                    />
                  )}
                </g>
              </g>
            )
          })}
          <circle
            cx={0}
            cy={0}
            r={isPortrait ? (size >= 100 ? 7 : 6) : (isMe ? 5 : 4)}
            fill={isPortrait ? `url(#fs-core-${uid})` : (isMe ? '#fef3c7' : FLOWER_PERSON_GRADIENT.a.fill)}
            stroke={isPortrait ? '#fb7185' : (isMe ? '#d97706' : PETAL_BY_ID.agape.color)}
            strokeWidth={isPortrait ? 1.1 : (isMe ? 1 : 0.6)}
          />
          {isPortrait && isOnline && (
            <circle cx={size >= 100 ? 14 : 11} cy={size >= 100 ? -12 : -10} r={2.8} fill="#22c55e" stroke="#0f172a" strokeWidth={0.7} />
          )}
        </g>
      </svg>
      {showEmojiBelow && (
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
