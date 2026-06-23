/** Parcours première expérience — clés sessionStorage et redirections post-inscription. */

export const FIRST_EXPERIENCE_PENDING_KEY = 'fleur_first_experience_pending'
export const POST_REGISTER_ONBOARDING_KEY = 'fleur_post_register_onboarding'
export const LANDING_INTENTION_KEY = 'fleur_landing_intention'
export const FIRST_FLOWER_DONE_KEY = 'fleur_first_flower_done'

const EXPERIENCE_ROUTE_ROOTS = new Set([
  '',
  'home',
  'a-deux',
  'tirage',
  'tirage-papier',
  'session',
  'dreamscape',
  'eclosion',
  'checkin',
  'presentation',
  'onboarding-diagnostic',
  'fleur',
  'fleur-beta',
  'mes-duos',
  'login',
  'register',
  'profil-onboarding',
])

export function isExperienceRoute(relPath: string): boolean {
  const root = (relPath || '').split('/')[0] || ''
  return EXPERIENCE_ROUTE_ROOTS.has(root)
}

export function resolvePostRegisterPath(intent: string, cardId: string): string {
  if (intent === 'card_analysis' && cardId.trim()) {
    const decoded = decodeURIComponent(cardId.trim())
    return `/tirage?landing_card=${encodeURIComponent(decoded)}&welcome=1`
  }
  return '/a-deux/par-une-porte?welcome=1'
}

export function markFirstExperiencePending() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(FIRST_EXPERIENCE_PENDING_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearFirstExperiencePending() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(FIRST_EXPERIENCE_PENDING_KEY)
  } catch {
    /* ignore */
  }
}

export function markFirstFlowerDone() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(FIRST_FLOWER_DONE_KEY, '1')
    sessionStorage.removeItem(FIRST_EXPERIENCE_PENDING_KEY)
  } catch {
    /* ignore */
  }
}

export function readLandingIntention(): string {
  if (typeof window === 'undefined') return ''
  try {
    return sessionStorage.getItem(LANDING_INTENTION_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}
