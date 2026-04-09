# Fleur d'AmOurs — Guide Techno-UX (Gemini / IA externe)

> **But** : donner à une IA (Gemini, Claude, etc.) une vision **à la fois UX** (écrans, parcours, rôles, composants) et **technique** (Next.js App Router, API, JWT, MariaDB, i18n, env), pour que propositions d’évolution, refactors et nouvelles features restent **alignées** avec l’existant.

## Statut

- Version : `0.11`
- Dernière mise à jour : `2026-04-09` (état des lieux dépôt : ~163 handlers `route.ts`, correction audit promo/stats vs v0.10)

## Utilisation avec une IA externe (Gemini, etc.)

1. **Joindre ou coller ce fichier** en contexte système ou en pièce jointe ; il résume l’app sans remplacer la lecture du code.
2. **Pour une question précise** (« où est la patientèle ? », « quelle route pour le dashboard ? »), croiser avec les chemins indiqués en section 12 et ouvrir les fichiers cités.
3. **Pour un audit API à jour** : en prod, toute URL sans `next/src/app/api/.../route.ts` dédié retombe sur le catch-all → **404** (section 11). Pour reverifier le nombre de routes :  
   `(Get-ChildItem -Path "next/src/app/api" -Recurse -Filter "route.ts").Count` (PowerShell, depuis la racine du repo).
4. **Règles projet** (déploiements Jardin, cache IA) : `.cursor/rules/jardin-deployment-frozen.mdc`, `jardin-ai-token-cache.mdc`.
5. **Docs complémentaires** : `docs/DEV-VS-PROD.md`, `docs/BILLING-SETUP.md`, `docs/BUILD-AND-GIT-DEPLOY.md`.

## Comment mettre ce document à jour

Quand le programme change (routes, composants, UX, DB, variables, rôles), mettre à jour en priorité :

- Parcours et UX clés
- Arborescence (`AppShell`, `Sidebar`)
- API et sécurité (section 5, 11)
- Couche MariaDB (`db-*`, section 6)
- Config / env (section 4)
- Build / déploiement si le flux prod change
- Chiffres d’inventaire (handlers, vues) et section 11 (stubs / 404 prod)

---

## 1) Vision UX/UI (mental model)

### 1.1. App à navigation par « portes »

L’application est une suite de sections accessibles via une barre latérale et des entrées mises en avant :

- **Zone haute sidebar** (visible une fois connecté) : CTA **Dreamscape** (`/dreamscape`) et **Session / Phare** (`/session`).
- **Accueil** : Grand Jardin (`/prairie`), Clairière (`/clairiere`), Boutique (`/boutique`), home (`/`).
- **Découvrir** : Fleur (`/fleur`), **Fleur bêta** (`/fleur-beta`), Duo (`/duo`), Mes Fleurs (`/mes-fleurs`).
- **Explorer** : Tirages (`/tirage`).
- **Accompagnement** : Chat (`/chat`), annuaire (`/coaches`).
- **Compte** : profil (`/account`), notifications (`/notifications`, préférences `/notifications/preferences`).

La sidebar ajuste les items selon **admin**, **coach**, **user**. Coachs et admins ont un groupe **Coach** (repliable) : vue coach sur la home (`/?view=coach`), analytics (`/coach/analytics`), suivi (`/coach/suivi`), chat coach (`/coach/chat`), patientèle (`/coach/patientele`). **Note code** : la route `/coach` sans sous-segment rend **`CoachSuiviPage`** (pas un « dashboard coach » dédié sur ce segment vide).

Les **admins** ont en plus stats (`/stats`), campagnes (`/campaigns`), diagnostic (`/diagnostic`), et un bloc **Admin** (`/admin` : dashboard, suivi/patientèle partagés avec coach, sessions, tirages, science, users, prompts, promo, notifications, diffusions, analytics, **télémétrie** `/admin/telemetry`).

### 1.2. Layout

- Le « shell » client **`AppShell`** (`next/src/components/AppShell.tsx`) route selon le **premier segment** de chemin (après `basePath`).
- Les pages protégées utilisent **`Layout`** (sidebar + topbar) et **`ProtectedLayout`** selon `AuthContext`.

### 1.3. Rôles et effets UX

- **Admin** : menu admin, pages `adminOnly`.
- **Coach** : menu coach + pages `adminOrCoach`.
- **User standard** : parcours public / utilisateur.

Règles UX :

- Pas de session → redirection vers `/login` (avec `from=`).
- Mauvais rôle → redirection vers la home.
- **La barrière UX client ne remplace pas les contrôles sur chaque route API** (section 11).

---

## 2) Parcours et écrans clés (UX)

### 2.1. Auth et invitation coach vers patientèle

- URL de login peut inclure `invite_token` (query).
- **Écran** : `LoginPage` (login / register selon contexte).
- Après login/register, l’UI appelle `POST /api/coach/patients/accept-invite` avec `{ invite_token }`.
- **Effet DB** : invitation acceptée, seed sociale coach → patient, patientèle dérivée des seeds acceptées.

### 2.2. Espace Coach — Patientèle

- **Écran** : `CoachPatientelePage` — `/admin/patientele` ou `/coach/patientele`.
- Invitation (email, intention), lien copiable, liste patients avec fleur sociale, intentions, science, canal Clairière, recalcul science.

### 2.3. Tableau de bord (home)

- **Écran** : `HomePage` choisit le dashboard selon le rôle :
  - **Admin** : `AdminDashboardPage`
  - **Coach** (ou `/?view=coach`) : `CoachDashboardPage`
  - **Sinon** : `DashboardPage` (`next/src/views/DashboardPage.tsx`)
- Données agrégées via `fetchDashboardData` dans `next/src/api/dashboard.ts`. Insights IA : `POST /api/ai/dashboard-insight`, tendance : `POST /api/ai/dashboard-trend`.

### 2.4. Annuaire des coachs et messagerie

- `/coaches` → `CoachesDirectoryPage`.
- Liste : `GET /api/chat/coaches`. CTA message → `/chat?coach=<wp_user_id>` ; `ChatPage` normalise vers `?conv=`.
- Types / affichage : `next/src/lib/coach-profile.ts`.

### 2.5. Notifications et diffusions

- Utilisateur : `/notifications`, `/notifications/preferences`. APIs sous `next/src/app/api/notifications/*` (list, unread_count, mark_*, delete_read, register_push_token, stats, admin_*, create, ensure_tables — **ensure_tables** : contrôles admin selon correctifs sécurité).
- Push mobile : `PushNotificationProvider` (Capacitor) envoie le token au backend.
- Admin : **Diffusions** → `/admin/broadcasts` (`AdminBroadcastsPage`), APIs `next/src/app/api/admin/broadcasts/*`, emails via `next/src/lib/smtp.ts`.

---

## 3) Arborescence et composants (cibles pour modifications)

### 3.1. Routage AppShell

- Fichier : `next/src/components/AppShell.tsx`
- `basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'`
- **Publiques** sans layout complet : `/tirage/partage/:token`, `/dreamscape/partage/:token`
- **protectedPages** (clés) : `prairie`, `lisiere`, `clairiere`, `boutique`, `home`, `presentation`, `tirage`, `dreamscape` (ou `dreamscape/historique`), `session`, `fleur`, **`fleur-beta`**, `duo`, `mes-fleurs`, `cartes`, `coaches`, `chat`, `account`, `notifications` (+ `preferences`), `graph`, `science`, `matrix`
- **admin / adminSubRoute** : `''` (dashboard), `suivi`, `patientele`, `sessions`, `tirages`, `users`, `chat`, `prompts`, `promo`, `notifications`, `broadcasts`, `analytics`, `science`, **`telemetry`**
- **coach / coachSubRoute** : `''` (→ `CoachSuiviPage`), `suivi`, `analytics`, `patientele`, `chat`
- **stats** (tous rôles connectés), **campaigns** (admin), **diagnostic** (admin)
- Invité sur `/` / `home` : `LandingPage`

### 3.2. Sidebar

- `next/src/components/layout/Sidebar.tsx` — groupes i18n, badge unread Clairière (`useSocialStore` → API social unread), entrée **Fleur bêta**.

### 3.3. Fleur sociale

- `next/src/components/FleurSociale.tsx` — pétales, activité, badges.

### 3.4. Patientèle et « mes coachs »

- `CoachPatientelePage`, `DashboardMyCoaches` (`next/src/components/dashboard/DashboardMyCoaches.tsx`).

### 3.5. Annuaire

- `CoachesDirectoryPage`, `coach-profile.ts`.

### 3.6. Admin

- Vues `next/src/views/Admin*.tsx` + persistance `next/src/lib/db-*.ts`.

---

## 4) Configuration technique (Next.js + stack)

### 4.1. Stack

- Next.js App Router : pages catch-all `next/src/app/[[...path]]/page.tsx` + API `next/src/app/api/**/route.ts`
- MariaDB (`mysql2/promise`)
- Pas de PHP (règle projet Jardin)

### 4.2. Base path et déploiements

- `NEXT_PUBLIC_BASE_PATH` (défaut `/jardin`).
- Environnements **séparés** : ex. `www.eludein.art/jardin` et `https://app-fleurdamours.eludein.art/jardin` — pas de liens croisés.
- **Dev local** : `npm run dev.vps` (tunnel SSH MariaDB, Next local). Exemple d’env : `next/.env.local.example` → `.env` racine.
- **Prod (Coolify / Docker)** : `NEXT_PUBLIC_*` et URL publique figés au build. Build « skipped » : `docs/BUILD-AND-GIT-DEPLOY.md`.

### 4.3. Prérequis runtime (rappel)

- `MARIADB_*`, `DB_PREFIX`
- **`JWT_SECRET`** : en `production`, absent ou égal au fallback dev → **erreur fatale au démarrage** (`next/src/lib/jwt.ts`)
- `OPENROUTER_API_KEY` pour l’IA (sinon mocks sur plusieurs routes)
- `NEXT_PUBLIC_APP_URL` / cohérence URL publique
- `next/public/api/data/all_cards.json` selon parcours tirage
- Stripe : `docs/BILLING-SETUP.md`
- SMTP : `SMTP_*` (diffusions, transactionnel)
- Traduction : `POST /api/translate` — `LIBRETRANSLATE_URL`, optionnel `LIBRETRANSLATE_API_KEY`

---

## 5) API et sécurité

### 5.1. Client API

- `next/src/lib/api-client.ts` — base URL, header `X-Locale`, refresh JWT sur 401 via `POST /api/auth/refresh`.

### 5.2. Auth JWT

- Frontend : `next/src/contexts/AuthContext.tsx` (`auth_token`, `auth_user`, `isAdmin`, `isCoach`).
- Backend : `next/src/lib/api-auth.ts`, `next/src/lib/jwt.ts`.
- Dev : secret par défaut si `JWT_SECRET` absent ; **prod : secret obligatoire**.

### 5.3. Auth REST

- `next/src/api/auth.ts` + handlers `app/api/auth/*`.

### 5.4. Catch-all API

- `next/src/app/api/[[...path]]/route.ts` : **prod** → 404 sans handler dédié ; **dev** → stubs pour chemins historiques ; `POST chat/send` avec logique JWT (voir fichier).

### 5.5. Inventaire des handlers API (état dépôt)

- **Comptage actuel** : **163** fichiers `route.ts` sous `next/src/app/api/` (avril 2026).
- **Dossiers racine API** : `account`, `admin`, `ai`, `analytics`, `auth`, `billing`, `chat`, `coach`, `dreamscape`, `fleur`, `fleur-beta`, `health`, `help-chat`, `notifications`, `og`, `prairie`, `promo`, `proxy-image`, `sap`, `sessions`, `social`, `stats`, `tarot_readings`, `telemetry`, `translate`, `user`, `users`, plus `[[...path]]` (catch-all). Le dossier `contact_messages` existe sans `route.ts` au moment de l’audit — ne pas supposer d’endpoint actif.
- **Modules client** (`next/src/api/*.ts`, **25** fichiers) : `admin`, `ai`, `auth`, `billing`, `campaigns`, `cards`, `chat`, `coachPatients`, `dashboard`, `diagnostic`, `dreamscape`, `duo`, `fleur`, `fleur-beta`, `graph`, `notifications`, `prairie`, `science`, `sessions`, `social`, `stats`, `tarotReadings`, `telemetry`, `userCoaches`, `wordpress`.

Domaines principaux :

- **auth** : login, register, refresh, me, logout, users, account/delete, impersonate, …
- **ai** (liste exhaustive des handlers fichiers) : `analyze_mood`, `card-context`, `card-question`, `coach-fiche`, `coach-patient-fiche`, `dashboard-insight`, `dashboard-trend`, `door-intro`, `dreamscape_summarize`, `extract_door_summary`, `fleur-interpretation`, `plan14j`, `status`, `tarot-interpretation`, `test` (admin), `threshold`, `tuteur`
- **help** : `help-chat`
- **billing** : products, create-checkout-session, stripe-webhook
- **promo** : handlers dédiés — `redeem`, `codes` (+ create/update/delete), `redemptions`, `user-redemptions`, `admin-assign`, `remove-redemption` (tous sous `next/src/app/api/promo/`)
- **sap** : balance, preview, deduct, bonus
- **sessions** : my, `[id]`, update, shadow-stats, stats, …
- **fleur** / **fleur-beta** : submit, résultats, questions, duo-result, interprétation bêta, etc.
- **coach/patients** : liste, invite, accept-invite, rebuild
- **chat** : coaches, conversations/*, messages, send, mark_read, stats
- **social** : send_seed, send_message, channel_messages, accept_connection, presence_heartbeat, visit_lisiere, clairiere_unread_count, …
- **notifications** : list, unread_count, mark_*, register_push_token, admin_*, …
- **admin** : broadcasts (create, list, enqueue, worker, preview, …), prompts CRUD, science rebuild/config, credit-sap, credit-usage, user-usage, db-status, system-status, prairie/force-visible, push-test, …
- **dreamscape** : save, my, share, update, shared, shared-image, snapshot
- **prairie** : pollen, arroser, add-link, remove-link, check-visibility (voir 11.4)
- **stats** : overview, averages, results, result/[id] (GET/DELETE selon implémentation)
- **telemetry** : event(s)
- **translate** : proxy LibreTranslate
- **utilitaires** : health, proxy-image, firebase-messaging-sw, analytics/overview, tarot_readings/*, users/suivi, account/profile, user/access, user/my_coaches, og, …

---

## 6) Couche MariaDB

### 6.1. Modules `db-*` (persistance métier)

Fichiers sous `next/src/lib/` (avril 2026) : `db-auth`, `db-broadcasts`, `db-chat`, `db-coach-patient-fiches`, `db-coach-patients`, `db-dreamscape`, `db-events`, `db-fleur`, `db-fleur-beta`, `db-fleur-passation-stats`, `db-notifications`, `db-patient-staff-detail`, `db-prairie`, `db-promo`, `db-promo-access`, `db-quota-bonus`, `db-sap`, `db-sap-bonus`, `db-sessions`, `db-social`, `db-stripe-webhook`, `db-tarot`, `db-usage`, + `db.ts` (connexion / `isDbConfigured`). Point d’entrée sessions / cache IA : `db-sessions.ts` (`step_data_json`, `plan14j_json`, etc.).

### 6.2. Coach et patientèle

- Module : `next/src/lib/db-coach-patients.ts`
- Invitations : `fleur_coach_invitations`
- Seeds / canaux : `fleur_social_seeds`, `fleur_chat_channels`

### 6.3. Routes `coach/patients`

1. `GET /api/coach/patients` — `requireAdminOrCoach`
2. `POST /api/coach/patients/invite`
3. `POST /api/coach/patients/accept-invite` — `requireAuth`
4. `POST /api/coach/patients/rebuild`

### 6.4. Mes coachs

- `GET /api/user/my_coaches` — ex. `DashboardMyCoaches`

---

## 7) i18n

- `next/src/i18n/index.ts` — `t(key, vars)`
- Locales : `next/src/i18n/locales/fr.json`, `en.json`, `es.json`
- Locale requête : `setLocaleForRequests` + header `X-Locale`

---

## 8) OpenRouter (IA)

- Config : `next/src/lib/openrouter-config.ts` — `FLEUR_OPENROUTER_MODEL` || `OPENROUTER_MODEL` || défaut **`google/gemini-2.5-flash-lite`**
- Appels : `next/src/lib/openrouter.ts` (`openrouterCall`)
- Client frontend : `next/src/api/ai.ts` + `POST /api/help-chat`
- **`GET /api/ai/test`** : `requireAdmin`
- Nouvelles routes coûteuses : prévoir `requireAuth` (ou plus restrictif) et persistance cache (section 8.1)

### 8.1. Cache et persistance des sorties IA (règle workspace)

Sorties structurées réaffichables → **écrites en base** dès la première génération réussie ; lecture avant rappel modèle ; merges côté client/serveur qui **préservent** les blocs cache. Voir `db-sessions.ts`, `SessionPage`, `.cursor/rules/jardin-ai-token-cache.mdc`.

---

## 9) Billing (Stripe)

- `docs/BILLING-SETUP.md`

---

## 10) Journal (récent)

- **v0.4–v0.7** : sécurité, notifications, catch-all 404 prod, JWT fatal en prod, promo redeem, auth IA de base.
- **v0.8–v0.9** : dreamscape_summarize, correctifs IDOR / status / translate, régénération guide, espace `/coach/*`.
- **v0.10** : audit stubs / routes manquantes (snapshot mars 2026).
- **v0.11** : **état des lieux** chiffré (163 routes, 25 modules client API, 23 `db-*`), navigation **fleur-beta** / **admin/telemetry**, **correction** : promo + stats ont des handlers dédiés ; liste 404 prod réduite ; note **`billing.ts`** (warnings « stub » encore présents dans le client alors que le backend promo existe — dette UX/logs).

---

## 11) Points bloquants, risques, stubs et 404 prod

> Synthèse **2026-04-09**. Reverifier après ajout de routes.

### 11.1. Correctifs historiques (référence)

Sessions, notifications, JWT prod, IDOR fleur result, etc. : traités dans le code actuel — **revue** si modification de ces zones.

### 11.2. Risques résiduels

| # | Sujet | Détail |
|---|--------|--------|
| R3 | Jetons en localStorage | Risque XSS ; mitigation : cookies httpOnly, CSP. |
| R5 | Partages Dreamscape / tirage | Token dans l’URL (historique, Referer). |
| R6 | DUO par token | Sécurité = entropie du token stocké. |
| R7 | Worker diffusions | Cron JWT admin ou secret machine — ops. |

### 11.3. Structure et exploitation

- Double prod : configs isolées.
- `NEXT_PUBLIC_*` au build.
- SMTP pour diffusions.
- Build « skipped » → UI/API désynchronisées.
- Chaque nouveau handler : contrôle rôle + auth.
- `GET /api/proxy-image` : allowlist domaines.

### 11.4. Écarts client ↔ backend

| Module | Situation |
|--------|-----------|
| **`billing.ts` (promo)** | Plusieurs méthodes appellent des routes **réelles** sous `app/api/promo/` mais loggent encore `warnPromoStub` — **dette documentation / console** ; le comportement prod n’est plus « catch-all only » pour le promo admin. |
| **`campaigns.ts`** | Commentaire exact : pas de `app/api/campaigns/**` ; **404 en prod**. |
| **`cards.ts`, `diagnostic.ts`, `graph.ts`, `wordpress.ts`** | Pas de handlers dédiés pour `/api/cards*`, `/api/diagnostic`, `/api/graph`, `/api/simulate`, `/api/wp*` → **404 en prod**. |
| **`stats.ts`** | Handlers présents (`/api/stats/overview`, `averages`, `results`, `result/[id]`) — **opérationnel** si déployé. |

### 11.4.1 Audit prod (`NODE_ENV=production`)

Sans `route.ts` dédié → **404** (catch-all ne sert pas de stub en prod).

**Non opérationnel en prod** (tant que non implémenté) :

- `POST /api/diagnostic` (`diagnostic.ts`)
- `GET /api/graph`, `POST /api/simulate` (`graph.ts`)
- `GET|POST /api/campaigns*` (`campaigns.ts`)
- `GET|PUT|POST|DELETE /api/cards*`, `GET /api/files`, `GET /api/invariants` (`cards.ts`)
- `GET|POST /api/wp*` (`wordpress.ts`)

**Handlers présents** (ne plus classer comme « 404 promo/stats » vs v0.10) :

- **`/api/promo/*`** : CRUD codes, redeem, redemptions, admin-assign, etc.
- **`/api/stats/*`** : overview, averages, results, result/[id]

**Stub explicite malgré handler** :

- `GET /api/prairie/check-visibility` → `{ visible: false, reason: 'stub' }`

**Dossier vide / piège** :

- `next/src/app/api/contact_messages/` — pas de `route.ts` au dernier audit.

**Partiels / DB** : fallbacks si `isDbConfigured()` faux (ex. chat / clairière en mémoire).

### 11.5. Catch-all et stubs en développement

- **Prod** : 404 JSON pour routes non couvertes.
- **Dev** : `STUB_RESPONSES` + patterns ; `POST chat/send` avec JWT.

### 11.6. Fallbacks dans des routes réelles

| Comportement | Condition typique |
|--------------|-------------------|
| Chat `stub-` id | DB non configurée pour le chat |
| Messages clairière en mémoire | stub store si pas de DB |
| `user/access` | fallback soldes si DB indisponible |
| IA threshold / analyze_mood | mock si pas de clé ou erreur provider |

---

## 12) Cartographie rapide `next/src` (pour navigation dans le code)

| Zone | Rôle |
|------|------|
| `app/[[...path]]/` | Page unique + metadata (SEO partage tirage) ; monte `AppShell` |
| `app/api/**/route.ts` | Handlers REST |
| `components/` | UI réutilisable (`AppShell`, `Layout`, `FleurSociale`, …) |
| `views/` | **~48** pages écran (nommées `*Page.tsx` en majorité) |
| `api/` | Client HTTP typé vers le backend |
| `lib/` | Auth, DB, OpenRouter, SMTP, coach-profile, etc. |
| `contexts/` | `AuthContext`, … |
| `store/` | Zustand (locale, social, …) |
| `i18n/` | Chaînes et `t()` |

---

## 13) Axes d’évolution (pour brainstorm produit / tech)

Les items ci-dessous **ne sont pas une roadmap validée** ; ils servent à structurer une exploration avec une IA ou une revue produit.

- **Produit / UX** : parcours Fleur bêta vs Fleur stable ; cohérence coach (segment `/coach` vide vs dashboard home) ; pages **Campaigns** / **Diagnostic** / **Graph** / **Cartes** si l’API reste absente — soit implémenter l’API, soit retirer ou masquer l’UI en prod.
- **Technique** : aligner `billing.ts` sur la réalité des routes promo ; réduire la dépendance au catch-all en dev pour refléter la prod ; compléter ou supprimer `wordpress.ts` / `contact_messages`.
- **Sécurité** : durcissement JWT (cookies), CSP, revue partages par token.
- **Coût IA** : appliquer systématiquement la règle cache (section 8.1) sur toute nouvelle sortie structurée.
- **Ops** : documenter workers (broadcasts), secrets Coolify, double déploiement Jardin.

---

*Fin du guide v0.11.*
