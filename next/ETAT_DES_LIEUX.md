# État des lieux — Fleur d'AmOurs Next.js

*Document d'audit comparant `frontend/src` vs `next/src` — mise à jour : mars 2025*

**Migration complète effectuée** — Tous les PlaceholderPage ont été remplacés par des vues réelles.

---

## 1. PAGES

### 1.1 Pages migrées (existent dans next/src/views)

| Page | frontend | next | Notes |
|------|----------|------|-------|
| HomePage | (DashboardPage dans App) | ✅ HomePage | Affiche Dashboard / Coach / Admin selon rôle |
| LoginPage | ✅ | ✅ | |
| PresentationPage | ✅ | ✅ | |
| DashboardPage | ✅ | ✅ | |
| AccountPage | ✅ | ✅ | |
| ContactPage | ✅ | ✅ | |
| ChatPage | ✅ | ✅ | |
| FleurPage | ✅ | ✅ | |
| DuoPage | ✅ | ✅ | |
| MesFleursPage | ✅ | ✅ | |
| SessionPage | ✅ | ✅ | |
| TarotPage | ✅ | ✅ | |
| CardsPage | ✅ | ✅ | |
| DreamscapePage | ✅ | ✅ | |
| DreamscapeHistoriquePage | ✅ | ✅ | |
| DreamscapePartagePage | ✅ | ✅ | |
| PrairiePage | ✅ | ✅ | |
| UserLisierePage | ✅ | ✅ | |
| ClairierePage | ✅ | ✅ | |
| BoutiquePage | ✅ | ✅ | |
| AdminDashboardPage | ✅ | ✅ | |
| CoachDashboardPage | ✅ | ✅ | |

### 1.2 Toutes migrées

| Page | Route | Protection |
|------|-------|------------|
| NotificationsPage | /notifications | P |
| NotificationPreferencesPage | /notifications/preferences | P |
| StatsPage | /stats | P |
| CampaignsPage | /campaigns | A |
| DiagnosticPage | /diagnostic | A |
| GraphPage | /graph | P |
| SciencePage | /science | P |
| MatrixPage | /matrix | P |
| CoachSuiviPage | /admin/suivi | AOrC |
| AdminAnalyticsPage | /admin/analytics | AOrC |
| AdminSessionsPage | /admin/sessions | A |
| AdminTiragesPage | /admin/tirages | A |
| AdminUsersPage | /admin/users | A |
| AdminMessagesPage | /admin/messages | AOrC |
| AdminChatPage | /admin/chat | AOrC |
| AdminPromptsPage | /admin/prompts | A |
| AdminPromoPage | /admin/promo | A |
| AdminNotificationsPage | /admin/notifications | A |

P = protégé, A = admin, AOrC = admin ou coach

---

## 2. COMPOSANTS

### 2.1 Migrés (next/src/components)

- Dashboard: SèveTracker, SanctuaireLiens, StatsOverview, FleurSynthese, InsightAI, ChronicleList, EvolutionChart, EvolutionRadar, GhostComparator, InsightCard, DashboardSkeleton
- Social: RosaceResonance, TemperatureIndicator, SeedModal, DialogueStream, FleurSociale, GrandJardinGalaxie, PrairieOptInModal
- Layout: Layout, Sidebar, Toast, Breadcrumbs, LanguageSelector
- Divers: DreamscapeCanvas, DreamscapeRosace, FlowerSVG, FleurInterpretation, ShareFleurButton, ShareTirageButton, ExportPlan14j, CrystalTimeline, ConfirmationModal, BuyTarotCTA, InfoBubble, SapGauge, VoiceTextInput, TranslatableContent, NotificationCenter, OnboardingTour, HelpChatbot

### 2.2 Manquants dans next (à migrer si utilisé)

| Composant | frontend | next | Utilisé par |
|-----------|----------|------|-------------|
| DreamCard | ✅ | ❌ | — |
| DreamscapeScene | ✅ | ❌ | DreamscapePage (canvas suffit ?) |
| RadarDuo | — | (dans DuoPage ?) | DuoPage |

---

## 3. APIs (next/src/api)

| API | frontend | next | Remarques |
|-----|----------|------|-----------|
| auth | ✅ | ✅ | |
| dashboard | ✅ | ✅ | |
| notifications | ✅ | ✅ | next manque: create, adminList, adminDelete, test |
| social | ✅ | ✅ | |
| prairie | ✅ | ✅ | |
| fleur | ✅ | ✅ | |
| duo | ✅ | ✅ | |
| sessions | ✅ | ✅ | |
| tarotReadings | ✅ | ✅ | |
| dreamscape | ✅ | ✅ | |
| chat | ✅ | ✅ | |
| contact | ✅ | ✅ | |
| admin | ✅ | ✅ | |
| billing | ✅ | ✅ | |
| stats | ✅ | ✅ | |
| campaigns | ✅ | ✅ | |
| diagnostic | ✅ | ✅ | |
| graph | ✅ | ✅ | |
| science | ✅ | ✅ | |
| cards | ✅ | ✅ | |
| ai | ✅ | ✅ | |
| wordpress | ✅ | ✅ | |
| client | — | api-client.ts | cardImageUrl, getBase, etc. |

---

## 4. FORMULAIRES — Statut de migration

| Formulaire | Page | frontend | next | Champs principaux |
|------------|------|----------|------|-------------------|
| **Login** | LoginPage | ✅ | ✅ | email, password |
| **Contact** | ContactPage | ✅ | ✅ | name, email, request_type, message, preference, gdpr |
| **Account** | AccountPage | ✅ | ✅ | profile (name, pseudo, bio, avatar, profile_public), promo redeem |
| **Fleur QCM** | FleurPage | ✅ | ✅ | 24 questions, submit |
| **Duo** | DuoPage | ✅ | ✅ | Questionnaire 24 questions A/B, partnerToken |
| **Session steps** | SessionPage | ✅ | ✅ | first_words, steps, submit |
| **Tarot** | TarotPage | ✅ | ✅ | save (simple/4 portes) |
| **Notification prefs** | NotificationPreferencesPage | ✅ | ✅ | in_app_enabled, email_enabled, email_digest, quiet_hours |
| **Admin — Campagnes** | CampaignsPage | ✅ | ✅ | definition_id, recipient_emails, token_ttl_hours |
| **Admin — Diagnostic** | DiagnosticPage | ✅ | ✅ | coeur (8 pétales), temps, climat, histoire, mode |
| **Admin — Prompts** | AdminPromptsPage | ✅ | ✅ | name, content, type, activate |
| **Admin — Promo** | AdminPromoPage | ✅ | ✅ | code, duration_days, max_uses, expires_at |
| **Admin — Notifications** | AdminNotificationsPage | ✅ | ✅ | type, title, body, recipient_type, priority |
| **Admin — Users** | AdminUsersPage | ✅ | ✅ | app_role, add access, credit tokens/sap |

---

## 5. UTILITAIRES

| Utilitaire | frontend | next |
|------------|----------|------|
| dreamscapeShare | ✅ | ✅ |
| levers (parseLever, humanizeLever) | ✅ | ❌ (à ajouter) |

---

## 6. DONNÉES

| Fichier | frontend | next |
|---------|----------|------|
| fleurInterpretation | ✅ | ✅ |
| tarotCards (+ FOUR_DOORS) | ✅ | ✅ |
| dreamscapeLayout | ✅ | ✅ |

---

## 7. CONTEXTES

| Contexte | frontend | next |
|----------|----------|------|
| AuthContext | ✅ | ✅ |
| NotificationContext | ✅ | ✅ |
| useStore (zustand) | ✅ | ✅ |
