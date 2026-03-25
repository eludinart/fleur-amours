# Fleur d'AmOurs — Guide Techno-UX pour Gemini

> But: fournir à Gemini une compréhension **UX/UI (écrans, parcours, rôles, composants)** et **technique (Next.js, routes API, auth JWT, MariaDB, i18n, env, modules)**, afin que les prochaines modifications soient cohérentes et “dans l’esprit” de l’app.

## Statut

- Version: `0.1` (initiale)
- Dernière mise à jour: `2026-03-25`

## Comment mettre ce document à jour

Quand on change le programme (routes, composants, UX, DB, variables, rôles), je mettrai à jour ce document en priorité sur:

- “Parcours & UX clés”
- “Arborescence & composants”
- “API & sécurité”
- “Couche MariaDB (coach/patientèle)”
- “Config & variables d’environnement”

Si vous avez un changement fonctionnel important, je vous demanderai au besoin les critères UX attendus avant de l’inscrire.

---

## 1) Vision UX/UI (mental model)

### 1.1. App à navigation par “portes”

L’application est pensée comme une progression dans des “sections” (pages) accessibles via une barre latérale:

- Une **Accueil** (ex: “Grand Jardin”, “Clairière”, “Boutique”)
- Une section **Découvrir** (ex: “Fleur”, “Duo”, “Mes Fleurs”)
- Une section **Explorer** (ex: “Tirage”)
- Une section **Accompagnement** (ex: “Chat”, “Annuaire des coachs”)
- Une section **Compte** (ex: profil, notifications)

La barre latérale ajuste ses items en fonction du rôle de l’utilisateur (**admin**, **coach**, **user**).

### 1.2. Layout

- Une page “shell” gère le routage applicatif (table de pages) côté client.
- Les pages protégées affichent un **Layout** (sidebar + topbar) et sont contrôlées par `AuthContext`.

### 1.3. Rôles & effets UX

Rôles estimés à partir de champs du user chargé:

- **Admin**: voit menu “Admin …”, et certaines pages protégées admin-only.
- **Coach**: voit le menu “Coach …” et des pages coach/coach-or-admin.
- **User standard**: voit les pages “grand public / parcours utilisateur”.

Concrètement, l’UX applique ces règles:

- Si la session n’existe pas: redirection vers `/login`.
- Si l’utilisateur n’a pas le bon rôle: redirection vers la home.
- Les pages “coach/patientèle” apparaissent uniquement pour `isCoach` ou `isAdmin`.

---

## 2) Parcours & écrans clés (UX)

### 2.1. Auth & invitation coach -> patientèle

**Entrées UX**

- URL de login avec un `invite_token` (paramètre query).

**Écran**

- `LoginPage`
  - Mode `login` ou `register` selon présence d’un `invite_token`.

**Flux**

- Un coach génère un lien d’invitation.
- Le nouvel utilisateur s’inscrit (ou se connecte) puis l’app consomme l’invitation.

**Consommation (important)**

- Après login/register, l’UI envoie `POST` vers:
  - `POST /api/coach/patients/accept-invite`
  - payload: `{ invite_token }`

**Effet DB**

- La relation sociale “seed” coach -> patient est marquée acceptée, puis les patientèles coach se dérivent des seeds acceptées.

---

### 2.2. Espace Coach: “Patientèle”

**Écran**

- `CoachPatientelePage` (route admin/coach: `/admin/patientele` dans `AppShell`)

**Composants UX principaux**

- Bloc “Inviter une personne”
  - champ `email`
  - sélecteur `cadre/intention` via `INTENTIONS`
  - bouton `Inviter`
  - affichage du `inviteLink` (et bouton Copier)
- Bloc “Vos patientèles”
  - liste des patients acceptés
  - pour chaque patient:
    - fleur sociale (pétales) + identité (pseudo/email)
    - intention(s) attachée(s)
    - indicateur science: pas générée / disponible / générée
    - bouton “Ouvrir la Clairière” si `channelId` existe
    - bouton “Recalculer la science” (rebuild)
    - mini-liste de `faits` et `hypothèses` (limitées)

---

### 2.3. Dashboard utilisateur / coach

**Écran**

- `DashboardPage`

**UX**

- Liste de cartes “prochaines portes” selon:
  - session en cours
  - progression science (petals / chronicle)
- Affichage de sections:
  - coaching chats (selon accès)
  - “Mes coachs” (pour user standard)
  - modules de statistiques, chronicle, IA, etc.

**Point coach**

- Le dashboard peut proposer un CTA “Coach Dashboard” si `isAdmin || isCoach`.

---

## 3) Arborescence & composants (cibles pour modifications)

### 3.1. Routage “AppShell”

Fichier clé:

- `next/src/components/AppShell.tsx`

Rôle:

- construit les routes applicatives via `pathname` segmenté après `basePath`
- charge pages:
  - publiques: ex `dreamscape/partage`
  - protégées: tableau `protectedPages`
  - admin: bloc spécial `route === 'admin'`

Base path:

- `const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'`

Contrôle auth:

- `ProtectedLayout` utilise `useAuth()` et redirige si rôle incorrect.

---

### 3.2. Barre latérale

Fichier clé:

- `next/src/components/layout/Sidebar.tsx`

Rôle:

- génère items de navigation en fonction de `isAdmin` / `isCoach`
- affiche badge unread pour la clairière via `useSocialStore`
- affiche identité de l’utilisateur (avatar/email)

---

### 3.3. Couche UI “social”

Fichier clé:

- `next/src/components/FleurSociale.tsx`

Rôle:

- rend la “fleur sociale” (8 pétales) à partir de scores normalisés
- brightness selon `lastActivityAt`
- support de:
  - identité (pseudo)
  - online marker
  - badges sociaux (rosee/pollen reçus)

---

### 3.4. Patientèle coach & mes coachs

Fichiers clés:

- `next/src/views/CoachPatientelePage.tsx`
- `next/src/components/dashboard/DashboardMyCoaches.tsx`

Rôles:

- UI patientèle coach: invitation + liste patients + rebuild science
- UI user standard: liste de ses coachs acceptés (et CTA vers `clairiere/:channelId`)

---

## 4) Configuration technique (Next.js + stack)

### 4.1. Stack (contrainte “Node uniquement”)

- Next.js (App Router + route handlers `next/src/app/api/**/route.ts`)
- MariaDB via `mysql2/promise`
- Aucun PHP

---

### 4.2. Base path & déploiements

Base path:

- `NEXT_PUBLIC_BASE_PATH` (par défaut `'/jardin'`)

Déploiements:

- **Dev local**: `npm run dev.vps`
  - tunnel SSH pour MariaDB
  - Next.js côté local
- **Prod legacy (VPS Coolify)**:
  - Next.js et MariaDB “dans l’infra” (autonome)
  - URL publique type : `https://app-fleurdamours.eludein.art/jardin`

Voir aussi:

- `docs/DEV-VS-PROD.md`

---

## 5) API & sécurité

### 5.1. Client API (frontend -> route handlers)

Fichier clé:

- `next/src/lib/api-client.ts`

Fonctions importantes:

- gère le `base`:
  - en localhost: utilise l’origine actuelle + `BASE_PATH`
  - sinon: utilise `NEXT_PUBLIC_API_URL` si fourni
- gère `X-Locale`:
  - `setLocaleForRequests(locale)` injecte un header `X-Locale`
- gère refresh JWT:
  - en `401` (hors login/refresh/register), tente:
    - `POST /api/auth/refresh`
  - puis retry de la requête

---

### 5.2. Auth (JWT)

Fichiers clés côté frontend:

- `next/src/contexts/AuthContext.tsx`
  - stocke `auth_token` et `auth_user` dans `localStorage`
  - rafraîchit périodiquement via:
    - `authApi.refresh()`
  - calcule `isAdmin` et `isCoach` à partir des rôles dans `user`

Fichiers clés côté API:

- `next/src/lib/api-auth.ts`
  - `requireAuth` -> obtient `userId` via JWT `sub`
  - `requireAdmin` -> vérifie rôle `admin/administrator` (token puis DB via `authMe`)
  - `requireAdminOrCoach` -> autorise `admin` et `coach`

End points frontend:

- `next/src/api/auth.ts`
  - `/api/auth/login`
  - `/api/auth/register`
  - `/api/auth/refresh`
  - `/api/auth/me`

---

## 6) Couche MariaDB: “Coach <-> Patientèle”

Objectif:

- Gérer l’onboarding d’une patientèle via invitations
- Maintenir la dérivation “la patientèle d’un coach” à partir des relations acceptées

### 6.1. Modules clés

Fichier data:

- `next/src/lib/db-coach-patients.ts`

Table invitations:

- `fleur_coach_invitations`
  - token unique
  - status `pending` -> `accepted`
  - stocke `coach_user_id`, `invite_email`, `intention_id`

Table seeds / relation:

- seeds: `fleur_social_seeds` (statuts `pending/accepted`)
- channels: `fleur_chat_channels`

La logique est:

1. Création invitation (token + intention)
2. Consommation invitation:
   - valide l’email (meilleur effort)
   - marque invitation acceptée
   - crée la seed coach->patient via `sendSeed()`
   - lie la connexion via `acceptSeedConnection()`
3. Listing patientèle:
   - prend seeds `accepted` du coach
   - agrège `intention_id` par patient
   - calcule `fleurMoyenne` et `science` pour afficher la carte patient
   - récupère `channelId` entre coach/patient

---

### 6.2. API routes “coach/patients”

Ces routes sont directement utilisées par l’UX `CoachPatientelePage`:

1. `GET /api/coach/patients`
   - renvoie `{ patients: [...] }`
   - protégé `requireAdminOrCoach`
2. `POST /api/coach/patients/invite`
   - payload UI: `{ email, intention_id }`
   - renvoie `{ ok, token, inviteLink }`
3. `POST /api/coach/patients/accept-invite`
   - payload UI: `{ invite_token }`
   - protégé `requireAuth`
4. `POST /api/coach/patients/rebuild`
   - payload UI: `{ patient_user_id, locale }`
   - protégé `requireAdminOrCoach`
   - recalcul de `Science de la Fleur` pour le patient

---

### 6.3. API routes “mes coachs”

Routes:

- `GET /api/user/my_coaches`
  - renvoie `{ coaches: [...] }`
  - UI utilisée dans `DashboardMyCoaches`

---

## 7) i18n

Fichiers clés:

- `next/src/i18n/index.ts`
  - `t(key, vars)` récupère depuis `fr/en/es.json`
- `next/src/contexts/AuthContext.tsx` et pages:
  - utilisent `useStore` pour `locale`
  - utilisent `t(...)` pour traductions

Locales:

- `next/src/i18n/locales/{fr,en,es}.json`

---

## 8) OpenRouter (IA)

Objectif:

- exécuter des tâches IA pour l’app (tuteur, seuil de porte, extraction summaries, etc.)

Configuration OpenRouter:

- `next/src/lib/openrouter-config.ts`
  - `getOpenRouterModel()` lit `FLEUR_OPENROUTER_MODEL` ou fallback `OPENROUTER_MODEL`
  - fallback par défaut: `stepfun/step-3.5-flash`

Routes AI (principales, voir `next/src/app/api/ai/**/route.ts`):

- `GET /api/ai/status`
- `POST /api/ai/threshold`
- `POST /api/ai/tuteur`

Voir aussi:

- `docs/VERIFICATION-FRONTEND-BACKEND.md`
- `docs/DEV-VS-PROD.md` (troubleshooting OpenRouter mock/provider)

---

## 9) Billing (Stripe)

Doc de référence:

- `docs/BILLING-SETUP.md`

Variables clés (dans `.env`):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_YEARLY`
- `STRIPE_PRICE_CREDITS_100`

---

## 10) Checklist opérationnelle (déploiement)

Voir:

- `docs/VERIFICATION-FRONTEND-BACKEND.md`
- `docs/DEV-VS-PROD.md`

Principaux prérequis:

- `MARIADB_*` (host/port/db/user/pass) + `DB_PREFIX`
- `JWT_SECRET`
- `OPENROUTER_API_KEY`
- fichiers publics nécessaires (ex: `next/public/api/data/all_cards.json`)
- Stripe webhook secrets si facturation

---

## 11) Journal de modifications du document (pour Gemini)

`0.1` Initial: UX/UI (AppShell, Sidebar, pages login/dashboard/coach patientèle), Auth/JWT (client + api-auth), routes coach/patients + couche MariaDB, i18n, OpenRouter, Stripe, dev/prod.

`0.2` Refactor session IA: extraction de la logique conversation/tuteur dans `next/src/hooks/useAiSession.ts`, et segmentation de l’affichage de l’étape session via sous-composants (dans `next/src/views/SessionPage.tsx`).

