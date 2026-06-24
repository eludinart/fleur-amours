#!/bin/sh
# Wrapper Coolify — force les logs sur stdout (Coolify masque souvent stderr).
echo "[cron] $(date -u +%Y-%m-%dT%H:%M:%SZ) engagement remind $*"
echo "[cron] CRON_SECRET=${CRON_SECRET:+ok}${CRON_SECRET:-MANQUANT}"
echo "[cron] APP_PUBLIC_URL=${APP_PUBLIC_URL:-https://app-fleurdamours.eludein.art/jardin}"
if [ ! -f /app/cron-engagement-remind.mjs ]; then
  echo "[cron] ERREUR: /app/cron-engagement-remind.mjs introuvable — redéployer sans cache"
  exit 1
fi
node /app/cron-engagement-remind.mjs "$@"
rc=$?
echo "[cron] code retour: $rc"
exit $rc
