# Surfaces techniques Fleur d'AmOurs

## Code

- **Repo :** https://github.com/eludinart/fleur-amours
- **Local :** `c:\workspace` · `npm run dev.vps` · port **3001**
- **App Next :** dossier `next/`
- **Mobile :** Capacitor Android (`android/`, scripts `dev:android`, `build:apk`)

## Prod

- **Jardin :** https://app-fleurdamours.eludein.art/jardin (PWA scope `/jardin/`)
- **Coolify** sur VPS `187.124.42.135`
- **DB :** MariaDB Coolify — `wp_fleur_*`, `wp_users` (Hermes readonly via `fleur-sql.sh`)

## WordPress eludein.art (périmètre Fleur)

| Type | Exemples |
| --- | --- |
| Présentation | `/le-tarot-fleur-damours/`, `/systeme-fleur-damours-outil-de-cartographie/` |
| Tirages | `/tirage-en-ligne/`, `/tirage-des-4-portes/`, fleurs individuelle / relationnelle |
| Pro / formation | `/espace-pro/`, modules |
| Commerce | `/produit/tarot-fleur-d-amours/` |
| Ops | `ritual-admin-*` — sensible |

## Intégrations

- Auth WP ↔ app
- Stripe / abonnements (offre)
- Hermes analytics (lecture seule)
