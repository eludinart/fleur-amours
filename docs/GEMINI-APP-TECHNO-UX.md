# Fleur d'AmOurs — Guide Techno-UX pour Gemini

> But: fournir à Gemini une compréhension **UX/UI (écrans, parcours, rôles, composants)** et **technique (Next.js App Router, routes API, auth JWT, MariaDB, i18n, env, modules)**, afin que les prochaines modifications soient cohérentes et dans l’esprit de l’app.

## Statut

- Version: `0.10`

- Dernière mise à jour: `2026-03-30` (audit prod: routes API manquantes/stubs + recoupements `next/src`)

## Comment mettre ce document à jour

Quand le programme change (routes, composants, UX, DB, variables, rôles), mettre à jour en priorité:

- Parcours et UX clés

- Arborescence et composants (`AppShell`, `Sidebar`)

- API et sécurité

- Couche MariaDB (coach / patientèle)

- Config et variables d’environnement

- Build / déploiement si le flux prod change

- Section 11 — audit, stubs, risques résiduels

---

## 1) Vision UX/UI (mental model)

### 1.1. App à navigation par « portes »

L’application est une suite de sections accessibles via une barre latérale et des entrées mises en avant:

- **Zone haute sidebar** (toujours visible une fois connecté): CTA **Dreamscape** (`/dreamscape`) et **Session / Phare** (`/session`).

- **Accueil**: Grand Jardin (`/prairie`), Clairière (`/clairiere`), Boutique (`/boutique`), et home (`/`).

- **Découvrir**: Fleur (`/fleur`), Duo (`/duo`), Mes Fleurs (`/mes-fleurs`).

- **Explorer**: Tirages (`/tirage`).

- **Accompagnement**: Chat (`/chat`), annuaire (`/coaches`).

- **Compte**: profil (`/account`), notifications (`/notifications`, préférences `/notifications/preferences`).

La sidebar ajuste les items selon **admin**, **coach**, **user**. Les coachs et admins ont un groupe **Coach** (repliable): dashboard (`/?view=coach`), analytics (`/coach/analytics`), suivi (`/coach/suivi`), chat coach (`/coach/chat`), patientèle (`/coach/patientele`). Les **admins** ont en plus diagnostic, stats, campagnes, et un bloc **Admin** (`/admin`, diffusions, sessions, tirages, science, users, prompts, promo, notifications).

### 1.2. Layout

- La page « shell » `AppShell` route côté client selon le premier segment de chemin (après `basePath`).

- Les pages protégées utilisent `Layout` (sidebar + topbar) et `ProtectedLayout` selon `AuthContext`.

### 1.3. Rôles et effets UX

- **Admin**: menu admin, pages `adminOnly`.

- **Coach**: menu coach + pages `adminOrCoach`.

- **User standard**: parcours public / utilisateur.

Règles UX:

- Pas de session: redirection vers `/login` (avec `from=`).

- Mauvais rôle: redirection vers la home.

- **La barrière UX client ne remplace pas les contrôles sur chaque route API** (voir section 11).

---

## 2) Parcours et écrans clés (UX)

### 2.1. Auth et invitation coach vers patientèle

- URL de login peut inclure `invite_token` (query).

- **Écran**: `LoginPage` (login / register selon contexte).

- Après login/register, l’UI appelle `POST /api/coach/patients/accept-invite` avec `{ invite_token }`.

- **Effet DB**: invitation acceptée, seed sociale coach → patient, patientèle dérivée des seeds acceptées.

### 2.2. Espace Coach — Patientèle

- **Écran**: `CoachPatientelePage` — routes `/admin/patientele` ou `/coach/patientele`.

- Invitation (email, intention), lien copiable, liste patients avec fleur sociale, intentions, science, canal Clairière, recalcul science.

### 2.3. Tableau de bord (home)

- **Écran**: `HomePage` choisit le dashboard selon le rôle:

  - **Admin**: `AdminDashboardPage`

  - **Coach** (ou `/?view=coach`): `CoachDashboardPage`

  - **Sinon**: `DashboardPage` (`next/src/views/DashboardPage.tsx`)

- Données agrégées via `fetchDashboardData` dans `next/src/api/dashboard.ts` (accès SAP, sessions, fleurs, tirages, dreamscapes, prairie, chronique, pétales, etc.). Insights IA: `POST /api/ai/dashboard-insight`, tendance: `POST /api/ai/dashboard-trend`.

### 2.4. Annuaire des coachs et messagerie

- `/coaches` → `CoachesDirectoryPage`.

- Liste: `GET /api/chat/coaches`. CTA message → `/chat?coach=<wp_user_id>`; `ChatPage` normalise vers `?conv=`.

- Types / affichage: `next/src/lib/coach-profile.ts`.

### 2.5. Notifications et diffusions

- Utilisateur: `/notifications`, `/notifications/preferences`. APIs dédiées sous `next/src/app/api/notifications/*` (list, unread_count, mark_read, mark_all_read, delete_read, register_push_token, stats, admin_list, admin_delete, create, ensure_tables — **ensure_tables** réservé admin en prod conforme aux correctifs sécurité).

- Push mobile: `PushNotificationProvider` (Capacitor) envoie le token au backend.

- Admin: **Diffusions** → `/admin/broadcasts` (`AdminBroadcastsPage`), APIs `next/src/app/api/admin/broadcasts/*`, emails via `next/src/lib/smtp.ts`.

---

## 3) Arborescence et composants (cibles pour modifications)

### 3.1. Routage AppShell

- Fichier: `next/src/components/AppShell.tsx`

- `basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'`

- Pages **publiques** sans layout complet: `/tirage/partage/:token`, `/dreamscape/partage/:token`

- **protectedPages** (extrait des clés): `prairie`, `lisiere`, `clairiere`, `boutique`, `home`, `presentation`, `tirage`, `dreamscape` (ou `dreamscape/historique`), `session`, `fleur`, `duo`, `mes-fleurs`, `cartes`, `coaches`, `chat`, `account`, `notifications` (+ sous-route `preferences`), `graph`, `science`, `matrix`

- **admin / adminSubRoute**: `''` (dashboard), `suivi`, `patientele`, `sessions`, `tirages`, `users`, `chat`, `prompts`, `promo`, `notifications`, `broadcasts`, `analytics`, `science`

- **coach / coachSubRoute**: `''`, `suivi`, `analytics`, `patientele`, `chat`

- **stats**, **campaigns** (admin), **diagnostic** (admin)

- Landing invité sur `/` / `home`: `LandingPage`

### 3.2. Sidebar

- `next/src/components/layout/Sidebar.tsx` — groupes i18n, badge unread Clairière (`useSocialStore` → API social unread).

### 3.3. Fleur sociale

- `next/src/components/FleurSociale.tsx` — 8 pétales, activité, badges.

### 3.4. Patientèle et « mes coachs »

- `CoachPatientelePage`, `DashboardMyCoaches` (`next/src/components/dashboard/DashboardMyCoaches.tsx`).

### 3.5. Annuaire

- `CoachesDirectoryPage`, `coach-profile.ts`.

### 3.6. Admin

- Diffusions, prompts, promo, science, etc. sous `next/src/views/Admin*.tsx` + libs `db-*`.

---

## 4) Configuration technique (Next.js + stack)

### 4.1. Stack

- Next.js (App Router, `next/src/app/api/**/route.ts`)

- MariaDB (`mysql2/promise`)

- Pas de PHP (règle projet Jardin)

### 4.2. Base path et déploiements

- `NEXT_PUBLIC_BASE_PATH` (défaut `/jardin`).

- Environnements **séparés** (pas de liens croisés): ex. `www.eludein.art/jardin` et `https://app-fleurdamours.eludein.art/jardin`.

- **Dev local**: `npm run dev.vps` (tunnel SSH MariaDB, Next local). Variables d’exemple Next: `next/.env.local.example` pointe vers `.env` à la racine.

- **Prod (Coolify / Docker)**: `NEXT_PUBLIC_*` et `NEXT_PUBLIC_APP_URL` figés au build. Si Coolify indique « Build step skipped », voir `docs/BUILD-AND-GIT-DEPLOY.md`.

### 4.3. Prérequis runtime (rappel)

- `MARIADB_*`, `DB_PREFIX`

- **`JWT_SECRET`**: en `production`, absence ou valeur égale au fallback dev → **erreur fatale au démarrage** (`next/src/lib/jwt.ts`).

- `OPENROUTER_API_KEY` pour l’IA (sinon mocks sur plusieurs routes)

- `NEXT_PUBLIC_APP_URL` / cohérence URL publique

- `next/public/api/data/all_cards.json` selon parcours tirage

- Stripe: `docs/BILLING-SETUP.md`

- SMTP: `SMTP_*` pour diffusions et emails transactionnels

- Traduction proxy: `POST /api/translate` — `LIBRETRANSLATE_URL`, optionnel `LIBRETRANSLATE_API_KEY`

---

## 5) API et sécurité

### 5.1. Client API

- `next/src/lib/api-client.ts` — base URL (localhost vs `NEXT_PUBLIC_API_URL`), header `X-Locale`, refresh JWT sur 401 via `POST /api/auth/refresh`.

### 5.2. Auth JWT

- Frontend: `next/src/contexts/AuthContext.tsx` (`auth_token`, `auth_user`, `isAdmin`, `isCoach`).

- Backend: `next/src/lib/api-auth.ts` (`requireAuth`, `requireAdmin`, `requireAdminOrCoach`), `next/src/lib/jwt.ts` (`jwtEncode`, `jwtDecode`, refresh).

- **Important**: en dev, secret par défaut `dev-secret-change-in-production` si `JWT_SECRET` absent; **en prod, secret obligatoire** (throw au chargement du module).

### 5.3. Auth REST

- `next/src/api/auth.ts` — login, register, refresh, me, logout, compte, etc. (handlers sous `app/api/auth/`).

### 5.4. Catch-all API

- `next/src/app/api/[[...path]]/route.ts`: **production** → 404 pour toute URL sans handler dédié; **développement** → stubs pour chemins historiques; `POST chat/send` avec logique JWT (voir commentaires du fichier).

### 5.5. Inventaire des handlers API (extraits par domaine)

Les routes réelles vivent dans `next/src/app/api/<chemin>/route.ts`. Domaines principaux observés au 2026-03-29:

- **auth**: login, register, refresh, me, logout, users, account/delete, admin/impersonate, …

- **ai**: status, test (admin), threshold, tuteur, extract_door_summary, door-intro, plan14j, coach-fiche, coach-patient-fiche, card-context, card-question, fleur-interpretation, analyze_mood, dreamscape_summarize, dashboard-insight, dashboard-trend, tarot-interpretation

- **help**: help-chat

- **billing**: products, create-checkout-session

- **promo**: redeem (seul handler promo métier côté fichiers; le reste promo admin passe encore par catch-all en dev / 404 en prod si non implémenté)

- **sap**: balance, preview, deduct, bonus

- **sessions**: my, `[id]`, update, save (si présent), shadow-stats

- **fleur**: submit, my-results, questions, result, translate-questions, duo-result, …

- **coach/patients**: liste, invite, accept-invite, rebuild

- **chat**: coaches, conversations/*, messages, send, mark_read, stats

- **social**: send_seed, send_message, channel_messages, accept_connection, presence_heartbeat, visit_lisiere, clairiere_unread_count, …

- **notifications**: list, unread_count, mark_*, delete_read, register_push_token, admin_*, ensure_tables, …

- **admin**: broadcasts, prompts, science, credit-sap, db-status, user-usage, …

- **dreamscape**: save, my, share, update, shared-image

- **prairie**: pollen, arroser, add-link, remove-link

- **translate**: POST proxy LibreTranslate (auth + limite 5k chars)

- **utilitaires**: health, proxy-image, firebase-messaging-sw, analytics/overview, tarot_readings/*, users/suivi, account/profile, …

Pour la liste exacte, compter les fichiers `route.ts` sous `next/src/app/api/` (centaine de endpoints segmentés).

---

## 6) Couche MariaDB — Coach et patientèle

- Module: `next/src/lib/db-coach-patients.ts`

- Invitations: `fleur_coach_invitations`

- Seeds / canaux: `fleur_social_seeds`, `fleur_chat_channels`

### 6.1. Routes `coach/patients`

1. `GET /api/coach/patients` — `requireAdminOrCoach`

2. `POST /api/coach/patients/invite` — email + intention

3. `POST /api/coach/patients/accept-invite` — `requireAuth`

4. `POST /api/coach/patients/rebuild` — recalcul science patient

### 6.2. Mes coachs

- `GET /api/user/my_coaches` — ex. `DashboardMyCoaches`

---

## 7) i18n

- `next/src/i18n/index.ts` — `t(key, vars)`

- Locales: `next/src/i18n/locales/fr.json`, `en.json`, `es.json`

- Locale requête: `setLocaleForRequests` + header `X-Locale`

---

## 8) OpenRouter (IA)

- Objectif: tuteur, seuil de porte, mood / Dreamscape, plans 14j, fiches coach, interprétations, aide in-app, etc.

- Config: `next/src/lib/openrouter-config.ts` — `FLEUR_OPENROUTER_MODEL` || `OPENROUTER_MODEL` || défaut **`google/gemini-2.5-flash-lite`**.

- Appel générique: `next/src/lib/openrouter.ts` (`openrouterCall`).

- Client frontend: `next/src/api/ai.ts` + `POST /api/help-chat`.

- **`GET /api/ai/test`**: réservé **`requireAdmin`** (tous environnements où la route est déployée), teste OpenRouter avec JSON attendu.

- **Auth**: routes IA sensibles utilisent `requireAuth` (dont `status`, `analyze_mood`, `dreamscape_summarize`, etc. — garder ce principe pour toute nouvelle route facturable ou coûteuse).

### 8.1. Cache et persistance des sorties IA (règle workspace)

Les sorties structurées réaffichables (résumés, plans, snapshots de seuil, fiches) doivent être **écrites en base** dès la première génération réussie (`step_data_json`, `plan14j_json`, etc.), lues avant de rappeler le modèle, et les updates client doivent **fusionner** les blocs cache. Voir `next/src/lib/db-sessions.ts`, `SessionPage`, règle `.cursor/rules/jardin-ai-token-cache.mdc`.

---

## 9) Billing (Stripe)

- `docs/BILLING-SETUP.md` — clés, webhooks, prix.

---

## 10) Journal (récent)

- **v0.4–0.5**: audit sécurité, diffusions / notifications.

- **v0.6**: prérequis regroupés, journal compact.

- **v0.7**: sessions et DDL sécurisées, catch-all 404 prod, promo **redeem** réel, JWT fatal en prod sans secret, auth IA de base.

- **v0.8**: dreamscape_summarize, fleur result IDOR, ai/status, translate authentifié.

- **v0.9**: **Régénération du guide** (inventaire routes, navigation Dreamscape/Session + espace `/coach/*`, dashboards home, liste complète des routes `api/ai/*`, JWT documenté comme fatal en prod, retrait des références obsolètes aux handlers « contact_messages » absents du dépôt actuel).

---

## 11) Points bloquants, risques, structure et stubs

> Synthèse au **2026-03-29**; à revérifier après évolution des routes.

### 11.1. Correctifs historiques (référence)

Les items B1–B4 et C1–C4 décrits dans les versions précédentes du guide (sessions non authentifiées, DDL notifications, JWT en prod, IDOR fleur result, etc.) sont traités dans le code actuel — **valider par revue** si vous touchez à ces fichiers.

### 11.2. Risques résiduels

| # | Sujet | Détail |
|---|--------|--------|
| R3 | Jetons en localStorage | Risque si XSS; mitigation long terme possible: cookies httpOnly, CSP. |
| R5 | Partages Dreamscape / tirage | Token dans l’URL (historique, Referer). |
| R6 | DUO par token | Sécurité = entropie du token stocké. |
| R7 | Worker diffusions | Cron avec JWT admin ou secret machine — documenter côté ops. |

### 11.3. Structure et exploitation

- Double prod (Hostinger vs VPS): configs isolées.

- `NEXT_PUBLIC_*` au build Coolify.

- SMTP requis pour emails de diffusion.

- Build « skipped » → UI/API désynchronisées (`docs/BUILD-AND-GIT-DEPLOY.md`).

- Cohérence rôles: contrôler **chaque** nouveau handler.

- `GET /api/proxy-image`: allowlist domaines (voir implémentation).

### 11.4. Client `next/src/api/*.ts` sans handler dédié

Plusieurs modules appellent encore des chemins qui, **s’il n’existe pas** de `route.ts` correspondant, tombent sur le catch-all (**404 en prod**). Domaines typiques documentés précédemment:

- **campaigns**: `campaigns.ts` → gestion campagnes souvent stub / incomplet côté API.

- **cards / diagnostic / graph**: imports, diagnostic, graphe — vérifier présence de handlers avant de s’en servir en prod.

- **promo admin**: seul `POST /api/promo/redeem` est un handler fichier dédié; les autres méthodes `billing.ts` (codes CRUD, redemptions list, admin-assign) loggent encore « stub » et reposent sur catch-all hors prod.

- **wordpress**: `wordpress.ts` — stubs/artefacts hérités. Note anti-lock-in : aucune intégration WordPress HTTP n’est active (les appels `/api/wp*` ne doivent pas être considérés comme une dépendance CMS en runtime).

- **stats legacy**: `stats.ts` utilise `/api/stats/...` — ne pas confondre avec **`GET /api/analytics/overview`** qui est un handler réel.

Vérification: comparer `next/src/api/*.ts` aux dossiers `next/src/app/api/**/route.ts` et tester en prod.

#### 11.4.1 Audit prod (instance `NODE_ENV=production`)
Base de calcul: `next/src/app/api/[[...path]]/route.ts` (en prod: 404 systématique pour toute route sans handler dédié).

Fonctionnalités non opérationnelles (routes sans `route.ts` dédié -> 404 en prod) :
- `POST /api/diagnostic` (module `diagnostic.ts`)
- `GET /api/graph` (module `graph.ts`)
- `POST /api/simulate` (module `graph.ts`)
- `GET|POST /api/campaigns*` (module `campaigns.ts`, client loggé STUB)
- `GET|PUT|POST|DELETE /api/cards*` (module `cards.ts`)
- `GET /api/files` (module `cards.ts`)
- `GET /api/invariants` (module `cards.ts`)
- `GET|POST /api/promo*` (module `billing.ts` : codes CRUD, redemptions, admin-assign, etc.)
- `GET|POST /api/wp*` (module `wordpress.ts`) : routes stub (artefacts), pas de connexion WordPress en runtime.
- `GET|POST /api/stats/*` (module `stats.ts`)
Note: `GET /api/analytics/overview` existe via handler dédié (ne pas confondre).

Fonctionnalités stub même avec handler :
- `GET /api/prairie/check-visibility` : renvoie toujours `{ visible: false, reason: 'stub' }`.

Cas partiels / dépendance DB:
- certains endpoints “réels” ont des fallbacks si `isDbConfigured()` est faux (ex: messages Clairière en mémoire).

Vérification recommandée pendant les tests pré-prod:
- confirmer en prod que les pages dépendantes ne “crash” pas (au minimum: toasts d’erreur / affichage “non dispo”) et que les routes réellement utilisées par l’UI correspondent bien à un handler présent dans `next/src/app/api/**`.

### 11.5. Catch-all et stubs en développement

- **Prod**: toute route non couverte → 404 JSON explicite.

- **Dev**: `STUB_RESPONSES` + patterns (campaigns, fleur, duo) pour développer sans tout implémenter; **`POST chat/send`** soumis à contrôle JWT.

### 11.6. Fallbacks dans des routes réelles

| Comportement | Condition typique |
|--------------|-------------------|
| Chat `stub-` id | DB non configurée pour le chat |
| Messages clairière en mémoire | `social-stub-store` si pas de DB |
| Accès SAP / `user/access` | fallback soldes si DB indisponible |
| IA threshold / analyze_mood | mock si pas de clé OpenRouter ou erreur provider |

---

*Fin du guide v0.10.*
