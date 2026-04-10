/**
 * Presets pour les pages « landing » de partage (même langage visuel / texte que les images OG).
 * Centralise hooks, CTA et puces pour pouvoir les faire évoluer par type de partage.
 */
import {
  OG_BRAND,
  OG_BRAND_LINE,
  OG_CHIP_FAST,
  OG_CHIP_FREE,
  OG_CHIP_PRIVATE,
  OG_DREAMSCAPE_CHIPS,
  OG_DREAMSCAPE_CTA,
  OG_DREAMSCAPE_HOOK,
  OG_DREAMSCAPE_KICKER,
  OG_DREAMSCAPE_SUB,
  OG_FLEUR_CHIPS,
  OG_FLEUR_CTA,
  OG_FLEUR_HOOK,
  OG_FLEUR_KICKER,
  OG_FLEUR_SUB,
  OG_TAROT_CHIPS_4,
  OG_TAROT_CHIPS_SIMPLE,
  OG_TAROT_CTA,
  OG_TAROT_FOOTER_MICRO,
  OG_TAROT_HOOK_4,
  OG_TAROT_HOOK_SIMPLE,
  OG_TAROT_KICKER_4,
  OG_TAROT_KICKER_SHARED,
  OG_TAROT_KICKER_SIMPLE,
  OG_TAROT_SUB,
} from '@/lib/og-share-copy'

const TRUST = [OG_CHIP_FREE, OG_CHIP_PRIVATE, OG_CHIP_FAST] as const

export type ShareLandingPaths = {
  primaryHref: string
  loginHref: string
  homeHref: string
}

export function buildShareLandingPaths(basePath: string): ShareLandingPaths {
  const bp = basePath.startsWith('/') ? basePath : `/${basePath}`
  return {
    primaryHref: `${bp}/register`,
    loginHref: `${bp}/login`,
    homeHref: `${bp}/`,
  }
}

export function tirageLandingCopy(isSimple: boolean, hasServerReading: boolean) {
  const kicker = hasServerReading
    ? OG_TAROT_KICKER_SHARED
    : isSimple
      ? OG_TAROT_KICKER_SIMPLE
      : OG_TAROT_KICKER_4
  const hook = isSimple ? OG_TAROT_HOOK_SIMPLE : OG_TAROT_HOOK_4
  const chipsPrimary = [...(isSimple ? OG_TAROT_CHIPS_SIMPLE : OG_TAROT_CHIPS_4)]
  const chipsTrust = [...TRUST]
  return {
    brandLine: OG_BRAND_LINE,
    brandName: OG_BRAND,
    kicker,
    hook,
    sub: OG_TAROT_SUB,
    chipsPrimary,
    chipsTrust,
    ctaLabel: OG_TAROT_CTA,
    footerMicro: OG_TAROT_FOOTER_MICRO,
    freeLabel: 'Gratuit',
  }
}

export function dreamscapeLandingCopy() {
  return {
    brandLine: OG_BRAND_LINE,
    brandName: OG_BRAND,
    kicker: OG_DREAMSCAPE_KICKER,
    hook: OG_DREAMSCAPE_HOOK,
    sub: OG_DREAMSCAPE_SUB,
    chipsPrimary: [...OG_DREAMSCAPE_CHIPS],
    chipsTrust: [...TRUST],
    ctaLabel: OG_DREAMSCAPE_CTA,
    footerMicro: OG_TAROT_FOOTER_MICRO,
    freeLabel: 'Gratuit',
  }
}

/** Prêt pour une future page /fleur/partage ou variante résultat (même logique que OG fleur). */
export function fleurLandingCopy() {
  return {
    brandLine: OG_BRAND_LINE,
    brandName: OG_BRAND,
    kicker: OG_FLEUR_KICKER,
    hook: OG_FLEUR_HOOK,
    sub: OG_FLEUR_SUB,
    chipsPrimary: [...OG_FLEUR_CHIPS],
    chipsTrust: [...TRUST],
    ctaLabel: OG_FLEUR_CTA,
    footerMicro: OG_TAROT_FOOTER_MICRO,
    freeLabel: 'Gratuit',
  }
}
