# Build local, Git et déploiement (legacy VPS)

Ce document décrit le flux habituel : **vérifier le build Next.js**, **commiter / pousser sur Git**, puis **déployer sur le VPS legacy** (Coolify). Pour le détail dev tunnel SSH et variables d’environnement, voir aussi [`RECAP-DEV-LEGACY.md`](./RECAP-DEV-LEGACY.md) et [`DEV-VS-PROD.md`](./DEV-VS-PROD.md).

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

## 3. Git : préparer le commit

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

## 4. Déploiement sur legacy (Coolify)

Le **code** arrive sur le serveur quand tu **push** ; l’**image** ou le **service** est reconstruit selon ta config Coolify.

1. **Push Git** (étape 3).
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

## 6. Résumé en trois lignes

1. `npm run build:next` → en cas d’erreur bizarre, supprimer `next/.next` puis rebuild.  
2. `git add -A` → `git commit` → `git push origin <branche>`.  
3. Coolify : **Redeploy / Rebuild** si nécessaire, puis vérifier l’app et `/api/ai/status`.
