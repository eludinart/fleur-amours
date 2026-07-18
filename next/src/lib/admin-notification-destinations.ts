/**
 * Destinations in-app / push pour les campagnes de notification admin.
 * Chemins Next relatifs au basePath (ex. `/checkin` → `/jardin/checkin`).
 */
export type AdminNotificationDestination = {
  id: string
  label: string
  /** Chemin avec slash initial, sans prefix /jardin ; vide = pas de lien */
  path: string
  /** Groupe affiché dans le sélecteur admin */
  group: string
}

/** Option « pas de clic » dans le sélecteur admin */
export const ADMIN_NOTIFICATION_DEST_NONE = 'none'

export const ADMIN_NOTIFICATION_DEST_CUSTOM = '__custom__'

/** Ordre des groupes dans le menu déroulant */
export const ADMIN_NOTIFICATION_DESTINATION_GROUP_ORDER = [
  'Comportement',
  'Formulaires & parcours',
  'Découvrir',
  'Pratique',
  'Social & jardin',
  'Accompagnement',
  'Compte',
  'Coach',
  'Admin',
] as const

export const ADMIN_NOTIFICATION_DESTINATIONS: AdminNotificationDestination[] = [
  { id: ADMIN_NOTIFICATION_DEST_NONE, label: 'Aucune (pas de lien au clic)', path: '', group: 'Comportement' },

  { id: 'home', label: 'Accueil', path: '/home', group: 'Comportement' },
  { id: 'notifications', label: 'Centre de notifications', path: '/notifications', group: 'Comportement' },

  { id: 'session', label: 'Parcours accompagné (session)', path: '/session', group: 'Formulaires & parcours' },
  { id: 'checkin', label: 'Check-in quotidien', path: '/checkin', group: 'Formulaires & parcours' },
  { id: 'onboarding-diagnostic', label: 'Diagnostic de base (baseline)', path: '/onboarding-diagnostic', group: 'Formulaires & parcours' },
  { id: 'eclosion', label: 'Timeline Éclosion', path: '/eclosion', group: 'Formulaires & parcours' },
  { id: 'couple', label: 'Espace duo (Dyade)', path: '/couple', group: 'Formulaires & parcours' },
  { id: 'dreamscape', label: 'Conversation intérieure', path: '/dreamscape', group: 'Formulaires & parcours' },
  { id: 'dreamscape_historique', label: 'Conversation intérieure — historique', path: '/dreamscape/historique', group: 'Formulaires & parcours' },
  { id: 'contact', label: 'Formulaire de contact', path: '/contact', group: 'Formulaires & parcours' },

  { id: 'fleur', label: 'Fleur d\'AmOurs', path: '/fleur', group: 'Découvrir' },
  { id: 'fleur-beta', label: 'Fleur bêta', path: '/fleur-beta', group: 'Découvrir' },
  { id: 'duo', label: 'Duo', path: '/duo', group: 'Découvrir' },
  { id: 'mes-fleurs', label: 'Mes fleurs', path: '/mes-fleurs', group: 'Découvrir' },
  { id: 'presentation', label: 'Présentation', path: '/presentation', group: 'Découvrir' },

  { id: 'tirage', label: 'Tirage', path: '/tirage', group: 'Pratique' },
  { id: 'cartes', label: 'Cartes / Manuel', path: '/cartes', group: 'Pratique' },
  { id: 'science', label: 'Science', path: '/science', group: 'Pratique' },
  { id: 'graph', label: 'Graphique', path: '/graph', group: 'Pratique' },
  { id: 'matrix', label: 'Matrice', path: '/matrix', group: 'Pratique' },

  { id: 'prairie', label: 'Grand jardin (Prairie)', path: '/prairie', group: 'Social & jardin' },
  { id: 'clairiere', label: 'Clairière', path: '/clairiere', group: 'Social & jardin' },
  { id: 'lisiere', label: 'Lisière', path: '/lisiere', group: 'Social & jardin' },
  { id: 'boutique', label: 'Boutique', path: '/boutique', group: 'Social & jardin' },

  { id: 'chat', label: 'Messagerie accompagnement', path: '/chat', group: 'Accompagnement' },
  { id: 'coaches', label: 'Annuaire des coachs', path: '/coaches', group: 'Accompagnement' },

  { id: 'account', label: 'Mon compte', path: '/account', group: 'Compte' },
  { id: 'notifications_preferences', label: 'Préférences notifications', path: '/notifications/preferences', group: 'Compte' },

  { id: 'coach_suivi', label: 'Coach — suivi', path: '/coach/suivi', group: 'Coach' },
  { id: 'coach_chat', label: 'Espace coach — messages', path: '/coach/chat', group: 'Coach' },

  { id: 'admin', label: 'Tableau de bord', path: '/admin', group: 'Admin' },
  { id: 'admin_presentation_stand', label: 'Présentation stand', path: '/admin/presentation-stand', group: 'Admin' },
  { id: 'admin_comms', label: 'Envois & notifications', path: '/admin/comms', group: 'Admin' },
  { id: 'admin_suivi', label: 'Suivi', path: '/admin/suivi', group: 'Admin' },
  { id: 'admin_patientele', label: 'Patientèle', path: '/admin/patientele', group: 'Admin' },
  { id: 'admin_users', label: 'Utilisateurs', path: '/admin/users', group: 'Admin' },
  { id: 'admin_promo', label: 'Codes promo', path: '/admin/promo', group: 'Admin' },
  { id: 'mycelium_dashboard', label: 'Mycélium — tableau de bord', path: '/mycelium/dashboard', group: 'Admin' },
  { id: 'mycelium_espace', label: 'Mycélium — jardin pro', path: '/mycelium/espace', group: 'Admin' },
  { id: 'mycelium_admin', label: 'Mycélium — admin', path: '/mycelium/admin', group: 'Admin' },
  { id: 'mycelium_climat', label: 'Mycélium — climat (legacy)', path: '/mycelium/climat', group: 'Admin' },
]

export function groupAdminNotificationDestinations(): Array<{
  group: string
  items: AdminNotificationDestination[]
}> {
  const byGroup = new Map<string, AdminNotificationDestination[]>()
  for (const d of ADMIN_NOTIFICATION_DESTINATIONS) {
    const list = byGroup.get(d.group) ?? []
    list.push(d)
    byGroup.set(d.group, list)
  }
  return ADMIN_NOTIFICATION_DESTINATION_GROUP_ORDER.flatMap((group) => {
    const items = byGroup.get(group)
    if (!items?.length) return []
    return [{ group, items }]
  })
}

export function resolveAdminNotificationAction(
  destinationId: string,
  customPath = '',
): { url: string | null; label: string } {
  if (destinationId === ADMIN_NOTIFICATION_DEST_CUSTOM) {
    const p = customPath.trim()
    if (!p) return { url: null, label: '' }
    const withSlash = p.startsWith('/') ? p : `/${p}`
    return { url: withSlash, label: 'Chemin personnalisé' }
  }
  const found = ADMIN_NOTIFICATION_DESTINATIONS.find((d) => d.id === destinationId)
  if (!found || found.id === ADMIN_NOTIFICATION_DEST_NONE || !found.path) {
    return { url: null, label: '' }
  }
  return { url: found.path, label: found.label }
}
