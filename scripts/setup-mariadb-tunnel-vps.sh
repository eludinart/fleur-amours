#!/bin/bash
# À exécuter une fois sur le VPS (ssh root@187.124.42.135) pour exposer
# MariaDB Coolify sur localhost:3306, afin que le tunnel SSH fonctionne.
#
# Le conteneur MariaDB n'est pas joignable depuis l'hôte (réseau coolify).
# Ce socat crée un relais 127.0.0.1:3306 → MariaDB sur le réseau Docker.

CONTAINER="juehpsnqkm60d2o6dhs38c5t"
NETWORK="coolify"

docker rm -f mariadb-tunnel 2>/dev/null
docker run -d --name mariadb-tunnel --restart unless-stopped \
  --network "$NETWORK" \
  -p 127.0.0.1:3306:3306 \
  alpine/socat \
  TCP-LISTEN:3306,fork,reuseaddr TCP:${CONTAINER}:3306

echo "Relais MariaDB : 127.0.0.1:3306 → ${CONTAINER}:3306"
echo "Test : mariadb -h 127.0.0.1 -P 3306 -u mariadb -p"
