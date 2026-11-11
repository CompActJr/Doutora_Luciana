# Repetir o ensaio local da etapa 1

Este roteiro cria ambientes fictícios e inclui builds manuais. Executar os builds somente com autorização explícita. Não usar os arquivos de ensaio na VPS nem reutilizar suas senhas em produção. O teste SMTP independente é `pnpm run test:smtp`.

Requisitos: Docker Desktop/Engine iniciado, Compose com suporte a `!override`, imagens referenciadas disponíveis e portas 18443/18567/20443/20567 livres. O teste SMTP exige OpenSSL; no Windows, o runner também procura o OpenSSL do Git.

Os comandos abaixo usam PowerShell, na raiz do projeto, e pressupõem os volumes de ensaio novos. `setup-validation` preserva arquivos de ambiente existentes; a restauração recusa volumes `dra-restore` existentes. Para repetir um ambiente já usado, revisar e remover conscientemente apenas seus recursos fictícios ou escolher novos nomes de projeto/portas de forma consistente. Nunca apagar volumes `dra-dev` ou executar limpeza global do Docker.

## 1. Preparar e construir

```powershell
node scripts/setup-validation.mjs
docker compose --env-file .env.validation -p dra-validation -f compose.yaml -f compose.prod.yaml -f compose.validation.yaml config --quiet
docker compose --env-file .env.validation -p dra-validation -f compose.yaml -f compose.prod.yaml -f compose.validation.yaml build
docker build -f infra/testing/tools.Dockerfile -t dra-validation-tools:local .
docker compose --env-file .env.validation -p dra-validation -f compose.yaml -f compose.prod.yaml -f compose.validation.yaml up -d --no-build --wait --wait-timeout 180
```

As imagens de aplicação são os mesmos alvos de produção. O override muda portas, origem e certificado para localhost e isola a saída de rede do n8n. A CA do Caddy só será confiada pelo cliente de teste; não é instalada no Windows. O primeiro download do n8n pode demorar.

## 2. Preparar contas fictícias e verificar HTTPS

```powershell
$env:VALIDATION_PASSWORD = ((Get-Content -LiteralPath .env.validation | Where-Object { $_ -like 'VALIDATION_PASSWORD=*' }) -split '=',2)[1]
docker compose --env-file .env.validation -p dra-validation -f compose.yaml -f compose.prod.yaml -f compose.validation.yaml run --rm --no-deps -e VALIDATION_ONLY=true -e VALIDATION_PASSWORD migrate pnpm --filter @dra/backend exec tsx tests/fixtures/seed-validation.ts
Remove-Item Env:VALIDATION_PASSWORD
docker cp dra-validation-caddy-1:/data/caddy/pki/authorities/local/root.crt backups/validation/caddy-root.crt
node scripts/test-validation-http.mjs --owner
```

`--owner` configura exclusivamente a primeira conta proprietária do n8n fictício. Não repetir essa opção quando a conta já existir. O script cria sessões admin/editor e verifica API, páginas e cookies; os cookies ficam em arquivo ignorado. As contas reais não são usadas.

## 3. Criar a credencial fictícia e executar o backup real

```powershell
node scripts/prepare-backup-validation.mjs
docker cp backups/validation/credential.json dra-validation-n8n-1:/tmp/validation-credential.json
docker exec -u node dra-validation-n8n-1 n8n import:credentials --input=/tmp/validation-credential.json
docker exec dra-validation-n8n-1 sh -c 'printf validation-persistent-data > /home/node/.n8n/validation-marker'
$validationProjectPath = (Get-Location).Path
docker run --rm --mount "type=bind,source=$validationProjectPath,target=/workspace" --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock --mount type=volume,source=dra-validation-backups,target=/restic-repo dra-validation-tools:local bash infra/testing/validate-backup.sh
```

O auxiliar Linux tem acesso ao socket Docker somente durante o teste, para executar a rotina real contra o projeto indicado. O restic usa volume e senha exclusivos. O script testa integridade com leitura total, rejeição de senha incorreta, conteúdo do arquivo de fonte e falhas controladas antes e depois da retomada dos serviços. Uma delas injeta falha de exportação no cliente auxiliar; não modifica o banco.

A rotina pausa brevemente backend, frontend, n8n e Caddy para manter os dumps e arquivos consistentes. O desenvolvimento continua independente. Os arquivos recuperados em `backups/validation/recovered` incluem o ambiente fictício; manter essa pasta privada e ignorada pelo Git.

## 4. Recriar contêineres e recuperar em instalação independente

```powershell
docker compose --env-file .env.validation -p dra-validation -f compose.yaml -f compose.prod.yaml -f compose.validation.yaml up -d --no-build --force-recreate --wait --wait-timeout 180
node scripts/test-validation-http.mjs --resume
node scripts/verify-validation-runtime.mjs
node scripts/restore-validation.mjs
node scripts/test-validation-http.mjs --restored
node scripts/test-validation-http.mjs --restored --fresh
node scripts/verify-validation-runtime.mjs --restored
```

A restauração usa o `production.env` recuperado do snapshot, ajustando apenas as portas locais; restaura os dois bancos em volumes novos, arquivos n8n/Caddy e confere a identidade da CA. O primeiro teste HTTP reutiliza as sessões do backup; `--fresh` verifica também novos logins. O teste de runtime confere contagens, migrations, permissões PostgreSQL, portas, usuário dos processos, logs e decifra a credencial fictícia com o [CLI oficial do n8n](https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line.md). Exportações temporárias são removidas do contêiner após a comparação.

Como o n8n está sem saída externa, comandos CLI podem demorar enquanto consultas externas expiram. Não liberar a rede para credenciais ou workflows reais durante esse ensaio.

## 5. Encerrar os ambientes fictícios

```powershell
docker compose --env-file .env.validation -p dra-validation -f compose.yaml -f compose.prod.yaml -f compose.validation.yaml down
docker compose --env-file .env.restore -p dra-restore -f compose.yaml -f compose.prod.yaml -f compose.validation.yaml -f compose.restore.yaml down
```

Esses comandos preservam os volumes e o repositório restic para inspeção. Não incluem `--volumes` e não afetam `dra-dev`. As evidências desta rodada estão em [RESULTADOS_VALIDACAO_ETAPA_1.md](RESULTADOS_VALIDACAO_ETAPA_1.md); as pendências externas continuam descritas ali.
