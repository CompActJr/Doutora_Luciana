#!/usr/bin/env bash
set -Eeuo pipefail
cd /workspace
export RESTIC_REPOSITORY=/restic-repo
export RESTIC_PASSWORD_FILE=/workspace/backups/validation/restic-password
bash -n infra/backup/backup.sh
restic snapshots >/dev/null 2>&1 || restic init
bash infra/backup/backup.sh backups/validation/backup.env
restic check --read-data
if RESTIC_PASSWORD_FILE=/workspace/backups/validation/wrong-password restic snapshots >/dev/null 2>&1; then
  echo "ERRO: repositório aceitou senha incorreta" >&2; exit 1
fi
echo "Repositório recusou senha incorreta."
restic restore latest --target /workspace/backups/validation/recovered
sed 's@RESTIC_PASSWORD_FILE=.*@RESTIC_PASSWORD_FILE=/workspace/backups/validation/wrong-password@' \
  backups/validation/backup.env > backups/validation/backup-failure.env
if bash infra/backup/backup.sh backups/validation/backup-failure.env; then
  echo "ERRO: backup com senha incorreta não propagou falha" >&2; exit 1
fi
compose=(docker compose --env-file .env.validation -p dra-validation -f compose.yaml -f compose.prod.yaml -f compose.validation.yaml)
for service in postgres backend frontend n8n caddy; do
  "${compose[@]}" ps --status running --services | grep -qx "$service"
done
echo "Falha controlada propagou erro e todos os serviços foram retomados."
bash infra/testing/validate-backup-failure.sh
snapshot=$(find backups/validation/recovered/var/tmp -mindepth 1 -maxdepth 1 -type d | head -n 1)
test -s "$snapshot/dra_app.dump"
test -s "$snapshot/n8n.dump"
test -s "$snapshot/production.env"
test -s "$snapshot/source.tar.gz"
tar -tzf "$snapshot/source.tar.gz" > backups/validation/archive-manifest.txt
if grep -Eq '^\./(\.env($|\.)|backups/|node_modules/|\.git/)' backups/validation/archive-manifest.txt; then
  echo "ERRO: fonte contém arquivos privados ou dependências" >&2; exit 1
fi
echo "$snapshot" > backups/validation/recovered-path.txt
echo "Backup completo, integridade integral, conteúdo e falha controlada aprovados."
