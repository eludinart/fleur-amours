#!/usr/bin/env bash
# Build Next.js puis git add / commit / push (équivalent Unix de scripts/build-and-push.ps1).
# Appelé depuis la doc BUILD-AND-GIT-DEPLOY.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMMIT_MSG="${1:-chore: build and git push}"

abort_if_sensitive() {
  # Refuse si un chemin sensible apparaît dans le statut (hors *.example).
  local line path
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    path="${line:3}"
    [[ "$path" == *' -> '* ]] && path="${path%% -> *}"
    path="${path#"${path%%[![:space:]]*}"}"
    [[ "$path" == *.example ]] || [[ "$path" == *.example/* ]] && continue
    if [[ "$path" =~ (^|/)\.env$ ]] || [[ "$path" =~ \.env\.local ]] || [[ "$path" =~ \.env\.production ]] || \
       [[ "$path" =~ (^|/)node_modules/ ]] || [[ "$path" =~ (^|/)\.next/ ]]; then
      echo "Aborted: fichier sensible ou artefact dans git status: $path" >&2
      exit 1
    fi
  done < <(git status --porcelain 2>/dev/null || true)
}

abort_if_sensitive

if [[ -z "${SKIP_BUILD:-}" ]]; then
  echo "=== [1/4] npm run build:next ==="
  npm run build:next
fi

if ! git status --porcelain | grep -q .; then
  echo "=== Rien à commiter. ==="
  exit 0
fi

echo "=== [2/4] git add -A ==="
git add -A

if git diff --cached --quiet; then
  echo "=== Aucun changement indexé. ==="
  exit 0
fi

echo "=== [3/4] git commit ==="
git commit -m "$COMMIT_MSG"

if [[ -n "${NO_PUSH:-}" ]]; then
  echo "=== [4/4] push ignoré (NO_PUSH=1) ==="
  exit 0
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
echo "=== [4/4] git push origin $branch ==="
git push origin "HEAD:$branch"

echo "=== Terminé. ==="
