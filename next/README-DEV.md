# Développement Next.js + MariaDB

L'application tourne en mode **Next.js + MariaDB** : pas de PHP, pas de proxy.

## Démarrage

### Option A — MariaDB local (Docker)

```bash
# 1. MariaDB (Docker)
docker compose up mariadb -d

# 2. Config
cp .env.example .env
# MARIADB_HOST=127.0.0.1, MARIADB_PORT=3306

# 3. Lancer
npm run dev
```

### Option B — MariaDB sur VPS (tunnel SSH)

Aucun MariaDB en local : seule l’instance du VPS est utilisée. Un tunnel SSH est requis.

```bash
# 1. Tunnel SSH (dans un terminal dédié)
ssh -L 3307:localhost:3306 USER@VPS_HOST

# 2. Config .env
# MARIADB_HOST=127.0.0.1
# MARIADB_PORT=3307
# MARIADB_PASSWORD=...

# 3. Lancer (le tunnel doit rester actif)
npm run dev
```

## Variables d'environnement (.env à la racine)

| Variable | Description |
|----------|-------------|
| SSH_VPS_HOST, SSH_VPS_USER | Tunnel SSH vers VPS |
| TUNNEL_LOCAL_PORT | 3307 |
| LOCAL_DB, LOCAL_USER, LOCAL_PASS | Credentials MariaDB Coolify |
| USE_NODE_API | true |
| JWT_SECRET | clé JWT |
| OPENROUTER_API_KEY | pour IA (tuteur, traduction, etc.) |

## Routes API

Toutes les routes sont servies par Next.js et lisent/écrivent en MariaDB via les modules `lib/db*.ts`.

- **Fleur** : questions, submit, result, answers, my-results, duo-result, translate-questions
- **Prairie** : fleurs, add-link, remove-link, arroser, pollen, check-visibility
- **Social** : my_channels, presence_heartbeat, etc.
- **Auth** : login, me, register, refresh
- **Sessions** : my, save, list, etc.

## Scripts utiles

- `npm run grant-admin` — donner les droits admin à un utilisateur (email par défaut)
- `npm run translate-fleur-questions` — traduire les questions QCM (Next.js doit tourner)
- `node scripts/fetch-session.js` — afficher une session (tunnel requis si MariaDB sur VPS)
