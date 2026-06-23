/**
 * Registre central des « modes de vue » de l'application.
 *
 * Un mode de vue est un masque côté UI qui détermine quelles sections du menu
 * sont visibles et dans quel ordre. Cela n'altère **aucun droit backend**.
 *
 * Profils :
 *  - `personnel` : parcours individuel (Fleur, explorations, être accompagné)
 *  - `coach`     : patientèle et conversations d'accompagnement
 *  - `rh`        : Mycelium / entreprise
 *  - `admin`     : outils d'administration
 */

export type ViewMode = 'personnel' | 'coach' | 'rh' | 'admin'

/** @deprecated Alias historique — migré vers `personnel` en v11 du store. */
export type LegacyViewMode = 'lambda' | ViewMode

export interface ViewModePermissions {
  isAdmin: boolean
  isCoach: boolean
  /** Admin « aussi coach » ou rôle coach app. */
  actsAsCoach: boolean
  isManager: boolean
  isRh: boolean
  myceliumAccess: {
    showAdmin?: boolean
    showDashboard?: boolean
    showEspace?: boolean
  } | null
}

export interface ViewModeDescriptor {
  mode: ViewMode
  labelKey: string
  descriptionKey: string
  icon: string
  activeClass: string
}

export const VIEW_MODE_DESCRIPTORS: Record<ViewMode, ViewModeDescriptor> = {
  personnel: {
    mode: 'personnel',
    labelKey: 'nav.viewModes.personnelLabel',
    descriptionKey: 'nav.viewModes.personnelDesc',
    icon: '🌸',
    activeClass:
      'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600',
  },
  coach: {
    mode: 'coach',
    labelKey: 'nav.viewModes.coachLabel',
    descriptionKey: 'nav.viewModes.coachDesc',
    icon: '💬',
    activeClass:
      'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
  },
  rh: {
    mode: 'rh',
    labelKey: 'nav.viewModes.rhLabel',
    descriptionKey: 'nav.viewModes.rhDesc',
    icon: '🍄',
    activeClass:
      'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700',
  },
  admin: {
    mode: 'admin',
    labelKey: 'nav.viewModes.adminLabel',
    descriptionKey: 'nav.viewModes.adminDesc',
    icon: '⚙',
    activeClass:
      'bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200 border-violet-300 dark:border-violet-700',
  },
}

/** Ordre d'affichage dans le sélecteur de vue. */
export const VIEW_MODE_ORDER: ViewMode[] = ['personnel', 'coach', 'rh', 'admin']

const VIEW_MODE_RANK: Record<ViewMode, number> = {
  personnel: 0,
  coach: 1,
  rh: 2,
  admin: 3,
}

export function getViewModeDescriptor(mode: ViewMode): ViewModeDescriptor {
  return VIEW_MODE_DESCRIPTORS[mode] ?? VIEW_MODE_DESCRIPTORS.personnel
}

/** Normalise une valeur persistée (y compris l'ancien slug `lambda`). */
export function normalizeStoredViewMode(stored: string | null | undefined): ViewMode | null {
  if (!stored) return null
  if (stored === 'lambda') return 'personnel'
  if ((VIEW_MODE_ORDER as readonly string[]).includes(stored)) {
    return stored as ViewMode
  }
  return null
}

function hasMyceliumAccess(perms: ViewModePermissions): boolean {
  const myc = perms.myceliumAccess
  return !!(myc?.showAdmin || myc?.showDashboard || myc?.showEspace)
}

function canActAsCoach(perms: ViewModePermissions): boolean {
  return perms.actsAsCoach || perms.isCoach || perms.isAdmin
}

/**
 * Vues sélectionnables : cumul des registres auxquels l'utilisateur a accès.
 * Un coach peut basculer personnel ↔ coach ; un RH personnel ↔ Mycelium, etc.
 */
export function getAvailableViewModes(perms: ViewModePermissions): ViewMode[] {
  const modes = new Set<ViewMode>(['personnel'])

  if (canActAsCoach(perms)) {
    modes.add('coach')
  }

  if (perms.isRh || perms.isManager || hasMyceliumAccess(perms)) {
    modes.add('rh')
  }

  if (perms.isAdmin) {
    modes.add('admin')
  }

  return VIEW_MODE_ORDER.filter((m) => modes.has(m))
}

/**
 * Vue « naturelle » la plus élevée selon les droits (admin > rh > coach > personnel).
 */
export function getNaturalViewMode(perms: ViewModePermissions): ViewMode {
  return getDefaultViewMode(getAvailableViewModes(perms))
}

export function getDefaultViewMode(available: ViewMode[]): ViewMode {
  if (available.includes('admin')) return 'admin'
  if (available.includes('rh')) return 'rh'
  if (available.includes('coach')) return 'coach'
  return 'personnel'
}

export function resolveViewMode(
  stored: string | null | undefined,
  available: ViewMode[]
): ViewMode {
  const normalized = normalizeStoredViewMode(stored)
  if (normalized && available.includes(normalized)) {
    return normalized
  }
  return getDefaultViewMode(available)
}

/** Vrai si l'utilisateur a choisi une vue moins « pro » que sa vue naturelle. */
export function isSimulatingLowerRole(current: ViewMode, available: ViewMode[]): boolean {
  if (available.length <= 1) return false
  const natural = getDefaultViewMode(available)
  return VIEW_MODE_RANK[current] < VIEW_MODE_RANK[natural]
}

/** Ordre des blocs sidebar selon le profil de navigation actif. */
export type SidebarBlockId =
  | 'home'
  | 'coach'
  | 'mycelium'
  | 'accompagnement'
  | 'explorations'
  | 'nav'
  | 'coachRequest'

const SIDEBAR_BLOCKS_BY_MODE: Record<ViewMode, SidebarBlockId[]> = {
  personnel: ['home', 'accompagnement', 'explorations', 'nav', 'coachRequest'],
  coach: ['home', 'coach', 'accompagnement', 'explorations', 'nav'],
  rh: ['home', 'mycelium', 'accompagnement', 'explorations', 'nav'],
  admin: ['home', 'coach', 'accompagnement', 'explorations', 'nav'],
}

export function getSidebarBlockOrder(viewMode: ViewMode): SidebarBlockId[] {
  return SIDEBAR_BLOCKS_BY_MODE[viewMode] ?? SIDEBAR_BLOCKS_BY_MODE.personnel
}
