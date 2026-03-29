/**
 * Destinations in-app / push pour les diffusions admin : chemins Next relatifs au basePath
 * (ex. `/chat` → `/jardin/chat` côté FCM et router).
 */
export type AdminNotificationDestination = {
  id: string
  label: string
  /** Chemin avec slash initial, sans prefix /jardin ; vide = pas de lien */
  path: string
}

/** Option « pas de clic » dans le sélecteur admin */
export const ADMIN_NOTIFICATION_DEST_NONE = 'none'

export const ADMIN_NOTIFICATION_DESTINATIONS: AdminNotificationDestination[] = [
  { id: ADMIN_NOTIFICATION_DEST_NONE, label: 'Aucune (pas de lien au clic)', path: '' },
  { id: 'home', label: 'Accueil', path: '/home' },
  { id: 'session', label: 'Parcours (session)', path: '/session' },
  { id: 'fleur', label: 'Fleur', path: '/fleur' },
  { id: 'duo', label: 'Duo', path: '/duo' },
  { id: 'mes-fleurs', label: 'Mes fleurs', path: '/mes-fleurs' },
  { id: 'chat', label: 'Messagerie accompagnement', path: '/chat' },
  { id: 'coach_chat', label: 'Espace coach — messages', path: '/coach/chat' },
  { id: 'notifications', label: 'Centre de notifications', path: '/notifications' },
  { id: 'account', label: 'Mon compte', path: '/account' },
  { id: 'clairiere', label: 'Clairière', path: '/clairiere' },
  { id: 'lisiere', label: 'Lisière', path: '/lisiere' },
  { id: 'prairie', label: 'Prairie', path: '/prairie' },
  { id: 'tirage', label: 'Tirage', path: '/tirage' },
  { id: 'dreamscape', label: 'Dreamscape', path: '/dreamscape' },
  { id: 'dreamscape_historique', label: 'Dreamscape — historique', path: '/dreamscape/historique' },
  { id: 'boutique', label: 'Boutique', path: '/boutique' },
  { id: 'coaches', label: 'Annuaire des coachs', path: '/coaches' },
  { id: 'admin', label: 'Admin — tableau de bord', path: '/admin' },
  { id: 'admin_broadcasts', label: 'Admin — diffusions', path: '/admin/broadcasts' },
  { id: 'admin_suivi', label: 'Admin — suivi', path: '/admin/suivi' },
  { id: 'admin_patientele', label: 'Admin — patientèle', path: '/admin/patientele' },
  { id: 'coach_suivi', label: 'Coach — suivi', path: '/coach/suivi' },
]

export const ADMIN_NOTIFICATION_DEST_CUSTOM = '__custom__'
