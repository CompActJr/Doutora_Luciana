#!/usr/bin/env bash
set -Eeuo pipefail

# Executado apenas quando o volume está vazio. psql faz o escape dos valores.
psql --username "$POSTGRES_USER" --dbname postgres \
  --set=ON_ERROR_STOP=1 \
  --set=app_password="$APP_DB_PASSWORD" \
  --set=n8n_password="$N8N_DB_PASSWORD" <<'SQL'
CREATE ROLE dra_app LOGIN PASSWORD :'app_password';
CREATE ROLE dra_n8n LOGIN PASSWORD :'n8n_password';
CREATE DATABASE dra_app OWNER dra_app;
CREATE DATABASE n8n OWNER dra_n8n;
REVOKE ALL ON DATABASE dra_app FROM PUBLIC;
REVOKE ALL ON DATABASE n8n FROM PUBLIC;
REVOKE ALL ON DATABASE postgres FROM PUBLIC;
SQL
