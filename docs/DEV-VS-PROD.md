# Dev vs Prod — différences et troubleshooting

## Contexte

- **Dev local** : `npm run dev.vps` → tunnel SSH vers MariaDB VPS + Next.js (3001).
- **Prod legacy** : VPS Coolify (app-fleurdamours.eludein.art) — Next.js + MariaDB. Autonome.

## Différences techniques

| Élément | Dev local | Prod legacy (VPS) |
|---------|-----------|-------------------|
| **API** | Next.js routes → MariaDB | Next.js routes → MariaDB |
| **DB** | Tunnel SSH → MariaDB VPS | MariaDB conteneur |
| **NEXT_PUBLIC_API_URL** | Vide (même origine) | Vide (même origine) |

## Note anti-dépendance WordPress

Aucune connexion WordPress HTTP n’est active depuis l’application (pas de REST/HTTP vers un site WordPress).
Les références `wordpress` / `wp_` visibles dans le code/doc sont des artefacts hérités (compatibilité de schéma / naming DB), pas une dépendance runtime à WordPress.

## Environnements autonomes

**app-fleurdamours.eludein.art** (VPS legacy) et **www.eludein.art/jardin** sont indépendants : pas de liens croisés.

## Checklist dev local (npm run dev.vps)

1. **Tunnel SSH** : Vérifier la connexion `ssh root@$SSH_VPS_HOST`
2. **Relais socat** : Sur le VPS, `scripts/setup-mariadb-tunnel-vps.sh` doit exposer MariaDB
3. **Variables** : `.env` avec `USE_NODE_API=true`, `LOCAL_*`, `MARIADB_*` (injectés par dev-vps)

## Checklist prod legacy (Coolify)

1. **MariaDB** : Ressource Coolify connectée au réseau du service Next.js
2. **Variables** : `MARIADB_HOST`, `JWT_SECRET`, `OPENROUTER_API_KEY`
3. **NEXT_PUBLIC_API_URL** : Vide ou absent → requêtes en même origine

---

## Troubleshooting : flux bloqué en prod legacy (pas de carte, pas de porte suivante)

**Symptômes** : En prod, vous restez bloqué sur la première porte, pas de proposition de carte, impossible de passer à la suivante.

**Causes possibles** :

1. **OpenRouter indisponible**
   - Vérifier : `https://app-fleurdamours.eludein.art/jardin/api/ai/status` → si `provider: "mock"`, OpenRouter n'est pas utilisé.
   - **Solution** : Vérifier `OPENROUTER_API_KEY` dans les variables d'environnement Coolify.

2. **Console navigateur**
   - Ouvrir F12 → onglet Network. Lors d'un envoi au Tuteur, vérifier que la requête vers `/jardin/api/ai/tuteur` retourne 200.

---

## Infos de connexion IA (OpenRouter)

| Variable | Où la définir | Priorité | Description |
|----------|---------------|----------|-------------|
| `OPENROUTER_API_KEY` | `.env` (dev), Coolify (prod) | Requise | Clé API OpenRouter |
| `FLEUR_OPENROUTER_MODEL` | `.env` | Prioritaire | Modèle utilisé par l'app |
| `OPENROUTER_MODEL` | `.env`, Coolify | Fallback | Modèle si FLEUR_ non défini |
