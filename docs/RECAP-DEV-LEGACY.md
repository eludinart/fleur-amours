# Recap Dev vs Legacy (VPS Coolify)

## 0) Rappel de périmètre (important)
- Environnements autonomes : `app-fleurdamours.eludein.art/jardin` et `www.eludein.art/jardin` sont independants (pas de liens croises).
- Stack : uniquement **Next.js + MariaDB** (Node), pas de PHP.

## Aide : build, Git et déploiement

Guide détaillé (build Next, Git, Coolify, **PowerShell depuis Windows**, scripts Bash / SSH) : [**BUILD-AND-GIT-DEPLOY.md**](./BUILD-AND-GIT-DEPLOY.md).

**Sur ta machine Windows**, à la racine du dépôt (ex. `c:\workspace`) :

```powershell
.\scripts\build-and-push.ps1 -CommitMessage "feat: ma livraison"
```

Sans te placer dans le dossier du repo (chemin à adapter) :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "c:\workspace\scripts\build-and-push.ps1" -CommitMessage "feat: ma livraison"
```

Si PowerShell bloque les scripts : `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`. Options du script : `-SkipBuild`, `-NoPush`. Tout le détail est dans **BUILD-AND-GIT-DEPLOY.md**.

## 1) Pre-requis (communs)
1. Repo Git a jour (branche de travail `main` ou autre, selon ton workflow).
2. Ne pas commiter de secrets / artefacts :
   - ne pas push `.env`, `.next`, `node_modules`
3. Avant deploy legacy : verifier que le build local passe.
   - Depuis la racine du repo : `npm run build:next`

## 2) Dev local (connexion au VPS MariaDB) : `npm run dev.vps`

### 2.1 Ce que fait `npm run dev.vps`
- Lance un tunnel SSH vers le VPS (script `scripts/dev-vps.js`).
- Redirige MariaDB sur le tunnel (variable `MARIADB_HOST=127.0.0.1` + port local).
- Demarre Next.js en dev sur `http://localhost:3001`.

### 2.2 Démarrage serveur
1. Depuis `c:\workspace` :
   - `npm run dev.vps`
2. Attendre “Ready in ...s”.

### 2.3 Verifications rapides
- Port : Next doit ecouter sur `3001`.
- Smoke test API :
  - `GET http://localhost:3001/` (doit repondre 200)
  - `GET http://localhost:3001/api/ai/status` (utile pour OpenRouter / provider)

### 2.4 Erreurs frequentes
#### A) `EADDRINUSE: address already in use :::3001`
Cause : un autre Next dev ecoute deja sur `3001`.
- Solution : tuer le process qui ecoute le port, puis relancer une seule instance.
Exemple PowerShell (a adapter) :
```powershell
$c = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if ($c) { Stop-Process -Id $c[0].OwningProcess -Force -ErrorAction SilentlyContinue }
npm run dev.vps
```

#### B) `ENOENT: ... .next/prerender-manifest.json` ou erreurs “chunks manquants”
Cause : etat incoherent du dossier `.next` (souvent apres build/dev interrompu).
- Solution “safe” :
```powershell
Stop-Process -Id (Get-Process -Name node | Select-Object -First 1).Id -Force -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force c:\workspace\next\.next
npm run dev.vps
```
(Plus simple : arreter dev.vps puis supprimer `next/.next` puis relancer.)

### 2.5 Rappels IA (OpenRouter)
- Si OpenRouter n’est pas correctement configure, certaines portes/actions peuvent rester bloquées.
- Verifier :
  - `https://app-fleurdamours.eludein.art/jardin/api/ai/status`
  - Si `provider: "mock"`, la cle OpenRouter n’est pas utilisable.

## 3) Legacy (VPS Coolify) : `app-fleurdamours.eludein.art/jardin`

### 3.1 Ce qu’il faut configurer dans Coolify
Au minimum (variables d’environnement) :
1. Connexion MariaDB :
   - `MARIADB_HOST`
   - `MARIADB_PORT` (si pertinent)
   - `MARIADB_DATABASE` / `DB_NAME`
   - `MARIADB_USER`
   - `MARIADB_PASSWORD`
   - `DB_PREFIX` (souvent `wp_`)
2. Auth :
   - `JWT_SECRET`
3. IA :
   - `OPENROUTER_API_KEY`
4. Optionnel (selon architecture) :
   - `NEXT_PUBLIC_API_URL` : souvent vide si meme origine.

### 3.2 Deploiement / rebuild
1. Pousser le code sur Git.
2. Dans Coolify, ouvrir le service “legacy”.
3. Cliquer **Redeploy / Rebuild** (selon la config).
4. Attendre que le build se termine.

### 3.3 Migration DB (recommandee)
Migration fournie dans le repo :
- `next/scripts/run-migration-010.js`

Commande (a executer dans l’environnement legacy, avec les bonnes variables DB) :
```bash
node next/scripts/run-migration-010.js --production
```

### 3.4 Checks apres deploy
1. Ouvrir :
   - `https://app-fleurdamours.eludein.art/jardin/`
2. Verifier la status IA :
   - `https://app-fleurdamours.eludein.art/jardin/api/ai/status`
3. Smoke test parcours :
   - Session porte suivante (si l’UI progresse, le flux est bon)

## 4) Pousser en Git (flux standard)

Tu peux enchaîner build + `add` + `commit` + `push` avec le script PowerShell (section **Aide** ci-dessus) au lieu des commandes manuelles.

### 4.1 Verifier l’etat
```bash
git status
```
Ne pas inclure `.env`, `.next`, `node_modules`.

### 4.2 Commit + push
```bash
git add -A
git commit -m "feat/science: facts & hypotheses + evidence pipeline"
git push origin main
```

## 5) Checklist ultra-courte (a connaitre)
- Dev : `npm run dev.vps` -> `Ready` -> test `api/ai/status`.
- Si ca casse : arreter dev, supprimer `next/.next`, relancer dev-vps.
- Legacy : set env vars dans Coolify -> push Git -> Redeploy -> run migration 010 si besoin -> verify `/api/ai/status`.

