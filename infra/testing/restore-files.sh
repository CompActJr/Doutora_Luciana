#!/usr/bin/env bash
set -Eeuo pipefail
cd /workspace
snapshot=$(cat backups/validation/recovered-path.txt)
[[ "$snapshot" =~ ^backups/validation/recovered/var/tmp/dra-backup\.[A-Za-z0-9]+$ ]]
cp -a "$snapshot/n8n-data/." /restore-n8n/
chown -R 1000:1000 /restore-n8n
cp -a "$snapshot/caddy-data/." /restore-caddy-data/
cp -a "$snapshot/caddy-config/." /restore-caddy-config/
test "$(cat /restore-n8n/validation-marker)" = validation-persistent-data
echo "Arquivos persistentes e marcador recuperados."
