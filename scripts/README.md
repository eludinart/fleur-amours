Scripts utilitaires Fleur d'AmOurs

Usage

- Merge cards:
  - `python scripts/merge_all_cards.py` — writes `RESULTAT/all_cards.json`

- Dev local :
  - `npm run dev` — Next.js (3001), MariaDB via tunnel
  - `npm run dev.vps` — tunnel SSH + Next.js (MariaDB VPS)

- Build + Git + push (voir `docs/BUILD-AND-GIT-DEPLOY.md`) :
  - Windows : `powershell -File scripts/build-and-push.ps1 -CommitMessage "..."`  
  - Bash / SSH : `bash scripts/build-and-git.sh "..."` ou `npm run build:git:push -- "..."`

- Test DB : `python scripts/test_db.py`
