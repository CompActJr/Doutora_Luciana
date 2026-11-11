#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

config_file=${1:-/etc/dra/backup.env}
set -a
source "$config_file"
set +a
: "${PROJECT_DIR:?Configure PROJECT_DIR}"
: "${RESTIC_REPOSITORY:?Configure RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD_FILE:?Configure RESTIC_PASSWORD_FILE}"
for tool in docker restic flock tar; do command -v "$tool" >/dev/null; done

exec 9>/var/lock/dra-backup.lock
flock -n 9 || { echo "Outro backup está em andamento." >&2; exit 1; }
cd "$PROJECT_DIR"
compose_env_file=${COMPOSE_ENV_FILE:-.env.production}
read -r -a compose_files <<< "${BACKUP_COMPOSE_FILES:-compose.yaml compose.prod.yaml}"
compose=(docker compose --env-file "$compose_env_file")
if [[ -n ${COMPOSE_PROJECT_NAME:-} ]]; then compose+=(-p "$COMPOSE_PROJECT_NAME"); fi
for compose_file in "${compose_files[@]}"; do compose+=(-f "$compose_file"); done
# A primeira versão faz uma pausa breve para manter banco e arquivos consistentes.
for service in postgres backend frontend n8n caddy; do
  "${compose[@]}" ps --status running --services | grep -qx "$service" || {
    echo "Serviço $service não está em execução; backup cancelado." >&2; exit 1;
  }
done

staging=$(mktemp -d /var/tmp/dra-backup.XXXXXXXX)
paused=0
cleanup() {
  local result=$?
  trap - EXIT
  if (( paused )); then
    "${compose[@]}" start backend frontend n8n caddy || result=1
  fi
  rm -rf -- "$staging"
  exit "$result"
}
trap cleanup EXIT

paused=1
"${compose[@]}" stop -t 60 backend frontend n8n caddy
"${compose[@]}" exec -T postgres pg_dump -U postgres -d dra_app -Fc > "$staging/dra_app.dump"
"${compose[@]}" exec -T postgres pg_dump -U postgres -d n8n -Fc > "$staging/n8n.dump"
"${compose[@]}" cp n8n:/home/node/.n8n "$staging/n8n-data"
"${compose[@]}" cp caddy:/data "$staging/caddy-data"
"${compose[@]}" cp caddy:/config "$staging/caddy-config"
cp "$compose_env_file" "$staging/production.env"
tar --exclude='./.git' --exclude='./node_modules' --exclude='*/node_modules' \
  --exclude='*/.next' --exclude='*/dist' --exclude='./backend/src/generated' \
  --exclude='./.env' --exclude='./.env.*' --exclude='./backups' \
  -czf "$staging/source.tar.gz" .

"${compose[@]}" start backend frontend n8n caddy
paused=0
restic backup --tag dra-luciana --host dra-clinica "$staging"
# Retenção automática só remove snapshots criados por esta rotina.
restic forget --tag dra-luciana --host dra-clinica --group-by host,tags \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
restic check
echo "Backup enviado e integridade do repositório verificada."
