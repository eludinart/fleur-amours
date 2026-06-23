/**
 * Registre central des « modes de vue » de l'application.
 *
 * Un mode de vue est un masque côté UI qui détermine quelles sections du menu
 * sont visibles. Cela n'altère **aucun droit backend** : un admin reste admin
 * et peut toujours accéder à ses routes via URL directe. C'est un outil pour :
 *  1. permettre à un utilisateur multi-rôles (ex. admin) de simuler l'expérience
 *     d'un rôle plus restreint (utilisateur lambda, coach, RH) ;
 *  2. recentrer le menu sur les fonctionnalités pertinentes du contexte courant.
 *
 * Pour ajouter un nouveau rôle dans le futur :
 *  - ajouter la valeur dans `ViewMode`,
 *  - ajouter son descripteur dans `VIEW_MODE_DESCRIPTORS`,
 *  - étendre `getAvailableViewModes()` avec la règle de droit,
 *  - exposer les sections correspondantes dans `Sidebar.tsx`.
 */

export type ViewMode = 'lambda' | 'coach' | 'rh' | 'admin'

export interface ViewModePermissions {
  isAdmin: boolean
  isCoach: boolean
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
  /** Clé i18n pour le libellé court (ex. "Utilisateur", "Coach", "RH", "Admin"). */
  labelKey: string
  /** Clé i18n pour la description (tooltip ou ligne secondaire). */
  descriptionKey: string
  /** Emoji représentatif. */
  icon: string
  /** Classes Tailwind pour le badge actif. */
  activeClass: string
}

export const VIEW_MODE_DESCRIPTORS: Record<ViewMode, ViewModeDescriptor> = {
  lambda: {
    mode: 'lambda',
    labelKey: 'nav.viewModes.lambdaLabel',
    descriptionKey: 'nav.viewModes.lambdaDesc',
    icon: '👤',
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

/** Liste ordonnée canonique (lambda → admin). Sert d'ordre d'affichage par défaut. */
export const VIEW_MODE_ORDER: ViewMode[] = ['lambda', 'coach', 'rh', 'admin']

export function getViewModeDescriptor(mode: ViewMode): ViewModeDescriptor {
  return VIEW_MODE_DESCRIPTORS[mode] ?? VIEW_MODE_DESCRIPTORS.lambda
}

/**
 * Détermine la vue « naturelle » d'un utilisateur d'après ses droits réels.
 * Sert de retombée par défaut et de seule vue accessible pour les non-admins.
 */
export function getNaturalViewMode(perms: ViewModePermissions): ViewMode {
  if (perms.isAdmin) return 'admin'
  const myc = perms.myceliumAccess
  const hasMyceliumAccess = !!(myc?.showAdmin || myc?.showDashboard || myc?.showEspace)
  if (perms.isRh || perms.isManager || hasMyceliumAccess) return 'rh'
  if (perms.isCoach) return 'coach'
  return 'lambda'
}

/**
 * Détermine les vues que l'utilisateur peut **sélectionner** dans le menu.
 *
 * **Politique** : la simulation multi-vues est un outil réservé aux administrateurs.
 *  - Admin → toutes les vues (`lambda`, `coach`, `rh`, `admin`) accessibles via le sélecteur.
 *  - Tous les autres (user, coach, RH non-admin…) → uniquement leur **vue naturelle**.
 *    Le sélecteur reste donc masqué pour eux (puisqu'une seule vue est dispo), mais
 *    la sidebar leur affiche correctement la section liée à leur rôle (Coach, Mycelium…).
 *
 * Cette séparation garantit qu'un coach ne peut pas voir/simuler la vue admin, et inversement.
 * Aucun droit backend n'est altéré : c'est uniquement un masque côté menu.
 */
export function getAvailableViewModes(perms: ViewModePermissions): ViewMode[] {
  if (!perms.isAdmin) {
    return [getNaturalViewMode(perms)]
  }
  return ['lambda', 'coach', 'rh', 'admin']
}

/**
 * Mode « naturel » par défaut sur la base d'une liste de vues disponibles.
 * Pour un admin (toutes vues dispo) → 'admin'. Pour les autres, retombée hiérarchique.
 */
export function getDefaultViewMode(available: ViewMode[]): ViewMode {
  if (available.includes('admin')) return 'admin'
  if (available.includes('rh')) return 'rh'
  if (available.includes('coach')) return 'coach'
  return 'lambda'
}

/**
 * Concilie une valeur stockée (possiblement obsolète) avec les vues réellement disponibles.
 * Si le mode stocké n'est plus accessible (perte de rôle), on retombe sur le défaut naturel.
 */
export function resolveViewMode(
  stored: string | null | undefined,
  available: ViewMode[]
): ViewMode {
  if (stored && (available as readonly string[]).includes(stored)) {
    return stored as ViewMode
  }
  return getDefaultViewMode(available)
}

/**
 * Indique si l'utilisateur est en train de simuler un rôle inférieur à son rôle « naturel ».
 * Sert à afficher le bandeau de rappel ("Vue utilisateur activée — revenir en vue admin").
 */
export function isSimulatingLowerRole(current: ViewMode, available: ViewMode[]): boolean {
  if (available.length <= 1) return false
  const natural = getDefaultViewMode(available)
  return current !== natural
}
