# Build local, Git et déploiement (legacy VPS)

Ce document décrit le flux habituel : **vérifier le build Next.js**, **commiter / pousser sur Git**, puis **déployer sur le VPS legacy** (Coolify). Un **résumé + commandes PowerShell** est aussi dans [`RECAP-DEV-LEGACY.md`](./RECAP-DEV-LEGACY.md) (section *Aide*). Index des docs : [`README.md`](./README.md). Pour le tunnel dev SSH et les variables d’environnement : [`RECAP-DEV-LEGACY.md`](./RECAP-DEV-LEGACY.md), [`DEV-VS-PROD.md`](./DEV-VS-PROD.md).

---

## 1. Où lancer les commandes

Toutes les commandes `npm` ci‑dessous partent de la **racine du dépôt** (dossier qui contient `next/`, `package.json`, `docker-compose.next.yml`).

---

## 2. Build de l’application (Next.js)

### Commande

```bash
npm run build:next
```

Équivalent : `npm run build --prefix next`. C’est la même étape que Coolify exécute en grande partie lors du build Docker.

### Si le build échoue avec `PageNotFoundError` (`/_not-found`, route API, etc.)

Souvent un dossier `next/.next` incohérent (build ou dev interrompu). À faire :

**PowerShell**

```powershell
Remove-Item -Recurse -Force .\next\.next -ErrorAction SilentlyContinue
npm run build:next
```

Puis relancer le build.

### Ce qu’il ne faut pas commiter

- `next/.next/` (artefacts de build, listés dans `.gitignore`)
- `node_modules/`
- fichiers secrets : `.env`, `.env.local`, `docker-compose.env` (copies locales remplies)

---

## 3. Tout-en-un : build + Git + push (scripts)

Deux scripts font **dans l’ordre** : vérifier qu’aucun fichier sensible n’est dans le statut → **`npm run build:next`** → **`git add -A`** → **`git commit`** → **`git push`** vers la branche courante.

### Windows (PowerShell) — depuis ta machine, dossier du repo

Ouvre **PowerShell** dans la racine du dépôt (celle qui contient `next\` et `package.json`). Par exemple :

1. Dans l’Explorateur de fichiers : va dans `c:\workspace` (ou ton clone), **Shift + clic droit** → **Ouvrir dans le terminal** / **Ouvrir la fenêtre PowerShell ici**.
2. Ou dans une console déjà ouverte :

```powershell
cd c:\workspace
```

*(Adapte le chemin si ton clone n’est pas `c:\workspace`.)*

Puis lance le script :

```powershell
.\scripts\build-and-push.ps1 -CommitMessage "feat: ma livraison"
```

**Si PowerShell refuse d’exécuter les scripts** (`running scripts is disabled`), une fois pour toutes pour ton utilisateur :

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

**Sans changer de répertoire** (chemin absolu vers le script, le script se place tout seul à la racine du repo) :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "c:\workspace\scripts\build-and-push.ps1" -CommitMessage "feat: ma livraison"
```

Options utiles (à ajouter comme paramètres) :

- **`-SkipBuild`** : seulement commit + push (pas de `npm run build:next`).
- **`-NoPush`** : build + commit, sans `git push`.

Exemple sans push (tu pousseras plus tard) :

```powershell
.\scripts\build-and-push.ps1 -CommitMessage "wip: sauvegarde" -NoPush
```

### Linux, macOS, WSL, Git Bash — ou **une commande SSH**

Script : [`scripts/build-and-git.sh`](../scripts/build-and-git.sh).

```bash
# Depuis la racine du repo
bash scripts/build-and-git.sh "feat: ma livraison"
```

Variables d’environnement :

- **`SKIP_BUILD=1`** : pas de build, uniquement git (si tu as déjà buildé).
- **`NO_PUSH=1`** : build + commit, sans push.

**Exemple en une ligne SSH** (machine distante où le clone du repo est déjà présent ; adapte utilisateur, hôte et chemin) :

```bash
ssh utilisateur@serveur 'cd /chemin/vers/workspace && bash scripts/build-and-git.sh "chore: deploy"'
```

Avec build sauté (tu as déjà validé le build ailleurs) :

```bash
ssh utilisateur@serveur 'cd /chemin/vers/workspace && SKIP_BUILD=1 bash scripts/build-and-git.sh "chore: sync"'
```

### npm (si `bash` est disponible, ex. Git Bash)

```bash
npm run build:git:push -- "feat: message de commit"
```

Sous **cmd.exe** sans Bash, utilise plutôt **`build-and-push.ps1`** ci-dessus.

---

## 4. Git : préparer le commit (à la main)

### Vérifier les changements

```bash
git status
```

### Ajouter les fichiers

```bash
git add -A
```

Ou ajouter fichier par fichier si tu veux exclure quelque chose : `git add chemin/vers/fichier`.

### Commit

Utilise un message clair (une ligne de titre, éventuellement un corps pour le détail) :

```bash
git commit -m "feat: description courte" -m "Détail optionnel : pourquoi, quoi tester."
```

### Pousser vers le dépôt distant (déclenche le déploiement si Coolify est branché sur Git)

```bash
git push origin main
```

Remplace `main` par ta branche de déploiement si elle est différente (`production`, etc.).

---

## 5. Déploiement sur legacy (Coolify)

Le **code** arrive sur le serveur quand tu **push** ; l’**image** ou le **service** est reconstruit selon ta config Coolify.

1. **Push Git** (section 3 ou 4).
2. Dans **Coolify**, ouvrir le service associé au Next legacy (souvent nommé « legacy » ou similaire).
3. Lancer **Redeploy** ou **Rebuild** si le déploiement automatique n’est pas activé ou si tu veux forcer une image neuve.
4. Attendre la fin du build et du démarrage du conteneur.

### Variables importantes (rappel)

- **Runtime** : `MARIADB_*`, `JWT_SECRET`, `OPENROUTER_API_KEY`, `USE_NODE_API=true`, URLs publiques (`NEXT_PUBLIC_APP_URL`, `APP_PUBLIC_URL` avec le base path `/jardin` si besoin). Détail dans [`RECAP-DEV-LEGACY.md`](./RECAP-DEV-LEGACY.md).
- **Build** : les `NEXT_PUBLIC_*` sont figées au moment du **build** ; un changement d’URL ou de clé exposée au client impose un **rebuild**, pas seulement un redémarrage.

### Après déploiement (smoke test)

- App : `https://app-fleurdamours.eludein.art/jardin/`
- IA : `https://app-fleurdamours.eludein.art/jardin/api/ai/status`

(Si ton domaine legacy diffère, adapte l’hôte ; voir `docker-compose.env.example` et les Dockerfiles pour les valeurs par défaut du repo.)

---

## 5. Build Docker en local (optionnel)

Pour tester l’image Next sans Coolify :

```bash
npm run docker:next:build
```

Ou :

```bash
docker build -f Dockerfile.next -t fleur-next:latest .
```

Compose : voir `docker-compose.next.yml` et la doc dans les commentaires en tête du fichier.

---

## 7. Résumé en trois lignes

1. **`npm run build:next`** (ou **`bash scripts/build-and-git.sh`** / **`build-and-push.ps1`**) → en cas d’erreur bizarre, supprimer `next/.next` puis rebuild.  
2. **`git add -A`** → **`git commit`** → **`git push`** (ou laisser le script section 3 le faire).  
3. Coolify : **Redeploy / Rebuild** si nécessaire, puis vérifier l’app et `/api/ai/status`.
