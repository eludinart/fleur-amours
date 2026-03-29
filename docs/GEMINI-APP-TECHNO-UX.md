# Fleur d'AmOurs — Guide Techno-UX pour Gemini

> But: fournir à Gemini une compréhension **UX/UI (écrans, parcours, rôles, composants)** et **technique (Next.js, routes API, auth JWT, MariaDB, i18n, env, modules)**, afin que les prochaines modifications soient cohérentes et “dans l’esprit” de l’app.

## Statut

- Version: `0.8`

- Dernière mise à jour: `2026-03-29`

## Comment mettre ce document à jour

Quand on change le programme (routes, composants, UX, DB, variables, rôles), je mettrai à jour ce document en priorité sur:

- “Parcours & UX clés”

- “Arborescence & composants”

- “API & sécurité”

- “Couche MariaDB (coach/patientèle)”

- “Config & variables d’environnement”

- “Build / déploiement (Coolify, Git)” si le flux prod change

- **§11 — Audit sécurité, structure, stubs** (dernière relecture code : 2026-03-29 — v0.8)

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

**Limite structurelle:** la barrière UX côté client ne remplace pas les contrôles serveur sur chaque route API (voir §11).

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

### 2.4. Annuaire des coachs & contact par messagerie

**Route**

- `/coaches` → `CoachesDirectoryPage` (tableau `protectedPages.coaches` dans `AppShell`)

**Sidebar**

- Entrée **Accompagnement** : lien vers l’annuaire (libellé type « Les accompagnants »), pas le formulaire contact historique.

**UX**

- Liste des coachs via `GET /api/chat/coaches` (`chatApi.coaches()`).

- Chaque fiche : bloc repliable (`<details>`) pour bio / spécialités / délais, puis CTA **Contacter par message** → navigation vers **`/chat?coach=<wp_user_id>`**.

**Chat côté patient**

- `ChatPage` lit `?coach=` : après chargement de la liste coachs, démarre (ou reprend) la conversation avec ce coach, puis normalise l’URL en `?conv=…` (paramètre `coach` retiré).

- Type partagé et helpers d’affichage : `next/src/lib/coach-profile.ts` (importés aussi par `ChatPage`).

---

### 2.5. Notifications in-app & admin “Diffusions”

**Utilisateur connecté**

- Pages: `/notifications`, préférences si présentes.

- API typiques: `GET /api/notifications/list`, `unread_count`, `mark_read`, `mark_all_read`, `delete_read`, `register_push_token` — protégées par `requireAuth` dans les handlers dédiés.

**Admin**

- Sidebar admin: entrée **Diffusions** → `/admin/broadcasts` (`AdminBroadcastsPage`).

- API: `next/src/app/api/admin/broadcasts/*` (create, preview, enqueue, list, worker) — `requireAdmin`.

- Envoi email: `next/src/lib/smtp.ts` (`SMTP_*`). Worker traite les files et peut créer des notifications in-app par destinataire.

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

- admin: lien **Diffusions** (`/admin/broadcasts`)

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

### 3.5. Annuaire coachs (page publique connectée)

Fichiers clés:

- `next/src/views/CoachesDirectoryPage.tsx`

- `next/src/lib/coach-profile.ts` (type `Coach`, titres, dernière activité, etc.)

### 3.6. Admin diffusions & notifications

Fichiers clés:

- `next/src/views/AdminBroadcastsPage.tsx`

- `next/src/lib/db-broadcasts.ts`, `next/src/lib/db-notifications.ts`

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

Environnements **séparés** (pas de liens croisés) :

- **www** (ex. Hostinger) : `www.eludein.art/jardin`

- **legacy / VPS Coolify** : `https://app-fleurdamours.eludein.art/jardin` (sous-domaine avec tiret, ex. `app-fleurdamours`)

Déploiements:

- **Dev local**: `npm run dev.vps`

  - tunnel SSH pour MariaDB

  - Next.js côté local

- **Prod legacy (VPS Coolify)**:

  - Next.js et MariaDB “dans l’infra” (autonome)

  - Build Docker (`Dockerfile.next` / compose) : les variables **`NEXT_PUBLIC_*`** et **`NEXT_PUBLIC_APP_URL`** (souvent avec suffixe `/jardin`) sont figées **au moment du build** Coolify.

  - Si les logs Coolify indiquent **« Build step skipped »** pour un commit donné, aucun `next build` n’a été rejoué pour ce SHA : voir **`docs/BUILD-AND-GIT-DEPLOY.md`** §6.

Docs associées (index : **`docs/README.md`**) :

- **`docs/BUILD-AND-GIT-DEPLOY.md`** — build local, Git, PowerShell (`build-and-push.ps1`), Bash / SSH, dépannage Coolify

- **`docs/RECAP-DEV-LEGACY.md`** — mémo dev / tunnel / checklist prod

- **`docs/DEV-VS-PROD.md`** — différences dev vs prod, OpenRouter

- **`docs/VERIFICATION-FRONTEND-BACKEND.md`** — checks rapides front / API

### 4.3. Prérequis runtime (rappel)

- `MARIADB_*` + `DB_PREFIX`

- `JWT_SECRET` (obligatoire en prod — throw fatal si absent, voir §11.1 B4 ✅)

- `OPENROUTER_API_KEY` si fonctionnalités IA

- `NEXT_PUBLIC_APP_URL` / `APP_PUBLIC_URL` (cohérents avec l’URL publique, `/jardin` si besoin)

- `next/public/api/data/all_cards.json` (selon parcours tirage / cartes)

- Stripe : `STRIPE_*` + webhook si facturation (`docs/BILLING-SETUP.md`)

- SMTP : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — optionnels : `SMTP_REPLY_TO`, `SMTP_ADMIN_TO` (destinataire notifications contact)

- Diffusions / Contact : `SMTP_*` requis (`next/src/lib/smtp.ts`) ; cron `POST /api/admin/broadcasts/worker` (auth admin)

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

- `next/src/lib/jwt.ts`

  - **`JWT_SECRET`** : en absence de variable, fallback **`dev-secret-change-in-production`** (risque critique en prod — voir §11.1 B4).

End points frontend:

- `next/src/api/auth.ts`

  - `/api/auth/login`

  - `/api/auth/register`

  - `/api/auth/refresh`

  - `/api/auth/me`

---

### 5.3. Route catch-all API

`next/src/app/api/[[...path]]/route.ts` : depuis v0.7, **404 systématique en production** pour toute URL sans handler dédié. En développement : stubs JSON pour les chemins connus, 404 pour les chemins inconnus. `POST chat/send` exige un JWT valide. Détail : **§11.5**.

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

  - fallback par défaut: `google/gemini-2.5-flash-lite` (coût minimal — corrigé v0.7 ✅)

Routes AI (principales, voir `next/src/app/api/ai/**/route.ts`):

- `GET /api/ai/status`

- `POST /api/ai/threshold`

- `POST /api/ai/tuteur`

Toutes les routes IA (`analyze_mood`, `threshold`, `tuteur`, `help-chat`) sont protégées par `requireAuth` depuis v0.7 (✅). Route de test `/api/ai/test` : 404 en prod, `requireAdmin` en dev (✅).

Voir aussi:

- `docs/VERIFICATION-FRONTEND-BACKEND.md`

- `docs/DEV-VS-PROD.md` (troubleshooting OpenRouter mock/provider)

---

## 9) Billing (Stripe)

Doc et variables : **`docs/BILLING-SETUP.md`** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_PRICE_CREDITS_100`, etc.).

---

## 10) Journal (récent)

- **v0.4–0.5** : audit §11 (sécurité + stubs §11.4), diffusions / notifications.

- **v0.6** : retrait des redondances et du journal historique détaillé ; prérequis regroupés en **§4.3**.

- **v0.7** : correction de tous les bloquants sécurité (B1–B4 ✅) + risques IA (R1 ✅) ; nouvelles routes réelles `promo/redeem`, `contact_messages/save` + libs `db-promo.ts` / `db-contact.ts` ; catch-all 404 en prod ✅ ; fallback OpenRouter → `google/gemini-2.5-flash-lite` ; migration SQL `docs/migration_v0.7.sql`.
- **v0.8** : correction des 4 nouveaux critiques : `requireAuth` sur `dreamscape_summarize` (C1 ✅), IDOR `fleur/result/[id]` supprimé (C2 ✅), `ai/status` protégé (C3 ✅), proxy LibreTranslate sécurisé + limite 5 000 chars (C4 ✅).

---

## 11) Points bloquants, risques sécurité, structure & stubs

> Synthèse code `next/src` au **2026-03-29** ; à valider après toute évolution des routes.

### 11.1. Bloquants sécurité (à traiter en priorité)

| # | Sujet | Fichier(s) / route | Problème |

|---|--------|---------------------|----------|

| ~~B1~~ | ~~**Sessions sans authentification**~~ | `POST /api/sessions/save`, `POST /api/sessions/update` (`next/src/app/api/sessions/save/route.ts`, `update/route.ts`) + `next/src/lib/db-sessions.ts` | Aucun `requireAuth` : n’importe qui peut **créer** des lignes `fleur_sessions` et **mettre à jour** une session si l’`id` est connu (spoofing email / step_data / plan14j, etc.). |

| ~~B2~~ | ~~**Traduction rituel sans garde**~~ | `POST /api/fleur/translate-questions` (`next/src/app/api/fleur/translate-questions/route.ts`) | Pas d’auth : exécute `ALTER TABLE` / `UPDATE` sur tables rituel + appels **OpenRouter** (coût + intégrité contenu). |

| ~~B3~~ | ~~**DDL notifications pour tout utilisateur connecté**~~ | `POST /api/notifications/ensure_tables` | `requireAuth` seulement : tout compte valide peut déclencher la création de tables (devrait être **`requireAdmin`** ou migration dédiée). |

| ~~B4~~ | ~~**`JWT_SECRET` par défaut**~~ | `next/src/lib/jwt.ts` | Si `JWT_SECRET` absent en prod, signature avec **`dev-secret-change-in-production`** → tokens falsifiables. |

> **v0.7 ✅** : B1–B4 tous corrigés. Sessions protégées par `requireAuth` + vérification ownership. Routes DDL en `requireAdmin`. `jwt.ts` throw fatal en prod si secret absent.

### 11.2. Risques élevés (abus, coût, fuite)

| # | Sujet | Détail |

|---|--------|--------|

| ~~R1~~ | ~~**IA sans auth**~~ | ~~`GET /api/ai/test`, `POST /api/ai/analyze_mood`, `POST /api/help-chat` : appels **OpenRouter** ou équivalent sans Bearer → **drain de quota / déni de budget**.~~ **✅ Corrigé v0.7** : `requireAuth` sur toutes les routes IA ; `/api/ai/test` → 404 prod. |

| ~~R2~~ | ~~**Traduction libre**~~ | ~~`POST /api/translate` : proxy vers LibreTranslate sans auth.~~ **✅ Corrigé v0.8** : `requireAuth` + limite 5 000 chars. |

| R3 | **Jetons en localStorage** | `AuthContext` : vol de session si **XSS** (préférence long terme : cookies httpOnly + CSP stricte). |

| ~~R4~~ | ~~**Catch-all API**~~ | ~~Stubs sans auth, POST `chat/send` factice.~~ **✅ Corrigé v0.7** : catch-all → **404 systématique en prod** ; `chat/send` exige un JWT valide ; routes contact & promo ont des handlers réels. |

| R5 | **Liens de partage** | `GET /api/dreamscape/shared`, `shared-image` : token dans l’URL (fuite possible via historique / Referer). |

| R6 | **Résultat DUO par token** | `GET /api/fleur/duo-result/[token]` : sécurité = entropie du token en base. |

| R7 | **Worker diffusions** | `POST /api/admin/broadcasts/worker` : cron avec JWT admin ou secret machine non standardisé dans le code. |

### 11.3. Structure, dette, exploitation

| # | Sujet | Détail |

|---|--------|--------|

| S1 | **Double prod** (Hostinger vs VPS) | Environnements **isolés** : dérive config / DB (règle `.cursor/rules`). |

| S2 | **`NEXT_PUBLIC_*` au build** | URL / basePath figés au build Coolify. |

| S3 | **SMTP manquant** | Diffusions email sans `SMTP_*` → échecs worker. |

| S4 | **Build Coolify “skipped”** | Déploiement sans `next build` pour un SHA → UI / API désynchronisés (`docs/BUILD-AND-GIT-DEPLOY.md`). |

| S5 | **Cohérence rôles** | L’UI ne suffit pas : chaque handler doit appliquer `requireAuth` / `requireAdmin` (cf. §11.1). |

| S6 | **Proxy image** | `GET /api/proxy-image` : allowlist `eludein.art`. |

### 11.4. Audit v0.8 — Corrections appliquées (C1–C4)

| # | Sujet | Fichier | Correction |
|---|-------|---------|------------|
| ~~C1~~ | ~~`dreamscape_summarize` OpenRouter public~~ | `next/src/app/api/ai/dreamscape_summarize/route.ts` | `requireAuth` ajouté ✅ |
| ~~C2~~ | ~~IDOR `fleur/result/[id]`~~ | `next/src/app/api/fleur/result/[id]/route.ts` | `requireAuth` obligatoire ; `userId` toujours transmis à `getResult` ✅ |
| ~~C3~~ | ~~`ai/status` public (fuite config)~~ | `next/src/app/api/ai/status/route.ts` | `requireAuth` ajouté ✅ |
| ~~C4~~ | ~~Proxy LibreTranslate sans auth~~ | `next/src/app/api/translate/route.ts` | `requireAuth` + limite 5 000 chars ✅ |

### 11.5. Fonctionnalités manquantes & stubs

> Handler `app/api/.../route.ts` **prioritaire** sur `app/api/[[...path]]/route.ts` ; les entrées du catch-all peuvent être **historiques**.

#### 11.5.1. Client `next/src/api/*.ts` → pas de `route.ts` dédié (catch-all uniquement)

Ces modules appellent des chemins pour lesquels il **n’existe pas** de dossier `next/src/app/api/.../route.ts` correspondant (0 fichier trouvé dans le dépôt) : le trafic retombe sur **`[[...path]]`**, qui renvoie des JSON **vides ou factices** (`ok: true`, listes vides, objets minimaux).

| Domaine | Fichier client | Préfixe API | Impact UX typique |

|--------|----------------|-------------|-------------------|

| **Campagnes** | `next/src/api/campaigns.ts` | `/api/campaigns`, `/api/campaigns/definitions`, `/api/campaigns/:id`, `/api/campaigns/:id/results`, `answer` | `CampaignsPage` : données de démo / pas de persistance réelle. |

| **Cartes / fichiers** | `next/src/api/cards.ts` | `/api/cards`, `/api/cards/import`, `/api/files`, `/api/invariants` | `CardsPage`, `DiagnosticPage`, `GraphPage` (imports cartes) : listes vides ou succès faux. |

| **Promo / billing codes** | `next/src/api/billing.ts` | `/api/promo/*` (codes CRUD, redemptions, admin-assign, …) | `AdminPromoPage` : CRUD admin toujours stub. **✅ `/api/promo/redeem`** : handler réel v0.7 (transaction SQL, anti-double-use, crédit SAP). |

| **Contact** | `next/src/api/contact.ts` | `/api/contact_messages/list`, `get`, `update`, `stats` | Admin messages contact : CRUD admin toujours stub. **✅ `/api/contact_messages/save`** : handler réel v0.7 (DB + SMTP + accusé de réception). |

| **WordPress** | `next/src/api/wordpress.ts` | `/api/wp/status`, `/api/wp/posts`, `/api/wp/pages` | Toute intégration WP via ces appels : stubs. |

| **Stats (legacy path)** | `next/src/api/stats.ts` | `/api/stats/overview`, `averages`, `results`, `result/:id` | **À ne pas confondre** avec `GET /api/analytics/overview` (handler réel). Ici le chemin est `/api/stats/...` → catch-all. |

| **Diagnostic / graphe** | `next/src/api/diagnostic.ts`, `next/src/api/graph.ts` | `/api/diagnostic`, `/api/graph`, `/api/simulate` | Pages diagnostic / graphe social : réponses génériques. |

Sinon souvent `{ ok: true, stub: true }` (fin de `getStubResponse`).

#### 11.5.2. Catch-all (`[[...path]]`)

**En production :** toutes les méthodes (GET, POST, PUT, PATCH, DELETE) retournent **404** avec le chemin dans le log.

**En dev :** `STUB_RESPONSES` pour les chemins connus + branches `campaigns/:id`, `fleur/`, `duo/` ; **POST `chat/send`** exige désormais un JWT valide (401 sinon) ✅ ; tout chemin inconnu → 404 (plus de `{ ok: true }` silencieux).

#### 11.5.3. Fallbacks dans des routes réelles

| Comportement | Fichier / route | Condition |

|--------------|-----------------|-----------|

| Message chat « stub » | `POST /api/chat/send` | `!isDbConfigured()` → JSON 201 avec `id: stub-…` (auth présente mais pas de DB). |

| Messages clairière en mémoire | `POST /api/social/send_message` + `next/src/lib/social-stub-store.ts` | `!isDbConfigured()` → `addStubMessage` (Map processus ; **perdu au redémarrage**). |

| Accès Sève / SAP | `GET /api/user/access` | DB indisponible → soldes **0** avec `free_access: true` (fallback). |

| Seuil / humeur IA | `POST /api/ai/threshold`, `POST /api/ai/analyze_mood` | Clé OpenRouter absente ou erreur → réponses **mock** (`node-mock`, objet MOCK). |

Vérification rapide : comparer `next/src/api/*.ts` à `next/src/app/api/**/route.ts` ; grep `stub-` et `social-stub-store` sous `app/api`.

---

*Fin du guide v0.8.*

