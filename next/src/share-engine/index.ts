/**
 * Moteur de partage Fleur d’AmOurs — point d’entrée unique pour intégrations.
 *
 * - Présets texte / CTA : `share-landing-presets` (alignés sur `og-share-copy`).
 * - Coquille visuelle pages publiques : `ShareLandingShell`.
 * - Fleur dans les partages (tirages, etc.) : `petals` + hook `useLatestFleurPetalsForShare`.
 *
 * Pour ajouter un nouveau surface de partage :
 * 1. Utiliser les mêmes constantes OG que la carte réseau (`og-share-copy`).
 * 2. Envelopper la page publique avec `ShareLandingShell` (variant `dark` | `warm`).
 * 3. Si la fleur utilisateur est pertinente, fusionner `shareFlower` dans le payload sauvegardé
 *    et l’exposer via l’API publique + route `/api/og/*` + page `…/partage/…`.
 */
export { ShareLandingShell, ShareLandingChipRow } from '@/components/share/ShareLandingShell'
export {
  buildShareLandingPaths,
  tirageLandingCopy,
  dreamscapeLandingCopy,
  fleurLandingCopy,
  type ShareLandingPaths,
} from '@/lib/share-landing-presets'
export {
  sanitizeShareFlowerPetals,
  pickDominantPetalId,
  parseShareFlowerFromPayload,
  type ShareFlowerSnapshot,
} from './petals'
export { useLatestFleurPetalsForShare } from '@/hooks/useLatestFleurPetalsForShare'
