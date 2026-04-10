/**
 * Blocs réutilisables pour les cartes Open Graph (next/og).
 */
import type { ReactNode } from 'react'
import { OG_BRAND, OG_BRAND_LINE } from '@/lib/og-share-copy'

const chipBase = {
  display: 'flex',
  alignItems: 'center',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.02em',
  padding: '6px 14px',
  borderRadius: 999,
} as const

export function OgBenefitChips({
  items,
  variant,
}: {
  items: readonly string[]
  variant: 'light' | 'dark'
}) {
  const border = variant === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(45,28,14,0.12)'
  const bg = variant === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)'
  const color = variant === 'dark' ? 'rgba(226,232,240,0.92)' : 'rgba(70,45,30,0.85)'

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map((label) => (
        <div
          key={label}
          style={{
            ...chipBase,
            background: bg,
            border: `1px solid ${border}`,
            color,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          {label}
        </div>
      ))}
    </div>
  )
}

export function OgBrandHeader({
  variant,
}: {
  variant: 'dark' | 'warm'
}) {
  const sub =
    variant === 'dark' ? 'rgba(196,181,253,0.78)' : 'rgba(100,70,45,0.55)'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        position: 'absolute',
        top: 36,
        left: 56,
        right: 56,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background:
              variant === 'dark'
                ? 'linear-gradient(135deg, rgba(167,139,250,0.35) 0%, rgba(244,114,182,0.2) 100%)'
                : 'linear-gradient(135deg, rgba(244,63,94,0.2) 0%, rgba(139,92,246,0.18) 100%)',
            border:
              variant === 'dark'
                ? '1px solid rgba(167,139,250,0.35)'
                : '1px solid rgba(180,120,90,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
            display: 'flex',
            fontSize: 18,
          }}
        >
          ✿
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: variant === 'dark' ? '#faf5ff' : '#2d1c0e',
              letterSpacing: '-0.02em',
            }}
          >
            {OG_BRAND}
          </span>
          <span style={{ fontSize: 12, color: sub, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {OG_BRAND_LINE}
          </span>
        </div>
      </div>
      <div
        style={{
          height: 2,
          width: 120,
          borderRadius: 2,
          background:
            variant === 'dark'
              ? 'linear-gradient(90deg, rgba(196,181,253,0.9), rgba(244,114,182,0.4), transparent)'
              : 'linear-gradient(90deg, rgba(244,63,94,0.55), rgba(139,92,246,0.45), transparent)',
          marginTop: 4,
        }}
      />
    </div>
  )
}

export function OgConversionFooter({
  ctaLabel,
  variant,
  leftHint,
}: {
  ctaLabel: string
  variant: 'dark' | 'warm'
  /** Texte réassurance à gauche (conversion). Défaut : invitation générique. */
  leftHint?: string
}) {
  const hint = leftHint ?? 'Un clic pour rejoindre l’expérience'
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 76,
        padding: '0 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background:
          variant === 'dark' ? 'rgba(2,6,23,0.78)' : 'rgba(253,248,240,0.92)',
        borderTop: variant === 'dark' ? '1px solid rgba(139,92,246,0.28)' : '1px solid rgba(180,120,80,0.18)',
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: variant === 'dark' ? 'rgba(226,232,240,0.82)' : 'rgba(80,50,30,0.72)',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          maxWidth: 560,
          lineHeight: 1.35,
        }}
      >
        <span style={{ opacity: 0.9, flexShrink: 0 }}>✿</span>
        <span>{hint}</span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background:
            variant === 'dark'
              ? 'linear-gradient(120deg, #7c3aed 0%, #db2777 55%, #c026d3 100%)'
              : `linear-gradient(120deg, #b45309 0%, #c2410c 45%, #7c3aed 100%)`,
          color: '#ffffff',
          fontSize: 18,
          fontWeight: 800,
          padding: '13px 28px',
          borderRadius: 999,
          letterSpacing: '-0.02em',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          boxShadow:
            variant === 'dark'
              ? '0 12px 40px rgba(124,58,237,0.5), 0 2px 10px rgba(0,0,0,0.4)'
              : '0 10px 32px rgba(180,83,9,0.28), 0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        {ctaLabel} →
      </div>
    </div>
  )
}

export function OgKicker({ children, variant }: { children: ReactNode; variant: 'dark' | 'warm' }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color:
          variant === 'dark' ? 'rgba(196,181,253,0.88)' : 'rgba(120,80,50,0.65)',
        marginBottom: 12,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: 'flex',
      }}
    >
      {children}
    </div>
  )
}

export function OgHook({
  children,
  variant,
  size = 'lg',
}: {
  children: ReactNode
  variant: 'dark' | 'warm'
  size?: 'lg' | 'md'
}) {
  return (
    <div
      style={{
        fontSize: size === 'lg' ? 34 : 28,
        fontWeight: 800,
        lineHeight: 1.15,
        letterSpacing: '-0.03em',
        color: variant === 'dark' ? '#f8fafc' : '#1a1008',
        marginBottom: 12,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: 'flex',
      }}
    >
      {children}
    </div>
  )
}

export function OgSubhook({ children, variant }: { children: ReactNode; variant: 'dark' | 'warm' }) {
  return (
    <div
      style={{
        fontSize: 17,
        lineHeight: 1.45,
        fontWeight: 500,
        color: variant === 'dark' ? 'rgba(226,232,240,0.78)' : 'rgba(70,45,30,0.78)',
        marginBottom: 20,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: 'flex',
      }}
    >
      {children}
    </div>
  )
}
