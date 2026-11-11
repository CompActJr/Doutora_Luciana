#!/usr/bin/env bash
set -Eeuo pipefail
cd /workspace
# Falha injetada apenas no cliente do contêiner auxiliar; os bancos não são alterados.
mkdir -p /tmp/dra-fault-bin
cat > /tmp/dra-fault-bin/docker <<'WRAPPER'
#!/usr/bin/env bash
if [[ "$*" == *"exec -T postgres pg_dump "* ]]; then
  echo "Falha de exportação injetada pelo ensaio." >&2
  exit 42
fi
exec /usr/local/bin/docker "$@"
WRAPPER
chmod +x /tmp/dra-fault-bin/docker
if PATH="/tmp/dra-fault-bin:$PATH" bash infra/backup/backup.sh backups/validation/backup.env; then
  echo "ERRO: falha de exportação não foi propagada" >&2; exit 1
fi
compose=(docker compose --env-file .env.validation -p dra-validation -f compose.yaml -f compose.prod.yaml -f compose.validation.yaml)
for service in postgres backend frontend n8n caddy; do
  "${compose[@]}" ps --status running --services | grep -qx "$service"
done
echo "Falha durante pausa: trap retomou os serviços e retornou erro."
