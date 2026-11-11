# Infraestrutura e operação

## Validação local — 10/11/2026

O plano completo e as evidências desta rodada estão em [PLANO_VALIDACAO_ETAPA_1.md](PLANO_VALIDACAO_ETAPA_1.md) e [RESULTADOS_VALIDACAO_ETAPA_1.md](RESULTADOS_VALIDACAO_ETAPA_1.md). Os registros de 08/11 abaixo descrevem a entrega anterior e suas limitações naquela data.

Os builds de desenvolvimento e produção foram autorizados e executados localmente. O backend inclui OpenSSL e certificados de CA; o alvo `migrate` inclui o cliente Prisma e seu schema engine, evitando downloads pela rede isolada do banco. Em desenvolvimento, esse serviço também usa imagem própria: alterações de migrations exigem um novo build explícito de `migrate`.

## Verificação desta entrega — 08/11/2026

- Geração do cliente e validação do schema Prisma 7: aprovadas.
- Tipagem dos três workspaces e seis testes de API, geração de segredos e topologia Compose: aprovados.
- Configurações Caddy de desenvolvimento e produção: validadas com a imagem oficial.
- Migration inicial: aplicada em PostgreSQL 17.11 local. Os dois usuários não podem conectar ao banco um do outro.
- Persistência: migration preservada após reinício do contêiner. Dump restaurado com sucesso em banco temporário separado, removido após o teste.
- API com PostgreSQL real: liveness e readiness retornaram HTTP 200.
- Frontend no servidor de desenvolvimento: página inicial e health retornaram HTTP 200.
- Scripts shell: sintaxe validada. `.env` e cliente Prisma gerado são ignorados pelo Git.

Nenhum build de aplicação ou imagem foi executado. As imagens próprias, o funcionamento do conjunto completo de contêineres, a emissão real de certificados, a inicialização do n8n e o backup/restauração com restic externo ainda não foram testados. O dump local valida a restauração do banco; não representa o aceite do plano de recuperação da VPS.

## Migração para pnpm

O projeto usa pnpm 12.18.0, fixado em `packageManager`. O lockfile do npm foi convertido com `pnpm import` e substituído por `pnpm-lock.yaml`. Os contratos usam `workspace:*`. A instalação com lockfile congelado e a limpeza de dependências antigas foram realizadas pelo pnpm; geração/validação Prisma, tipagem dos três workspaces e os seis testes passaram após a migração.

Os Dockerfiles usam a imagem oficial do pnpm com versão explícita, cache do store e instalação com `--frozen-lockfile`. A distribuição do backend usa `pnpm deploy --prod`, conforme a [documentação do pnpm](https://pnpm.io/cli/deploy). Em desenvolvimento, volumes específicos protegem os diretórios de dependências de cada workspace. A validação completa dessas imagens aguarda execução de build expressamente solicitada.

## Autenticação implementada

Login, logout, gestão de usuários e recuperação de senha estão implementados. A segunda migration acrescenta bloqueio de usuários e limitação persistente de tentativas. A tipagem e os testes locais de API/infraestrutura passaram, assim como 12 cenários de integração de autenticação em PostgreSQL temporário (13 testes incluindo o agrupamento).

As páginas de login e recuperação responderam HTTP 200 no Next.js em desenvolvimento; páginas protegidas redirecionaram pessoas sem sessão para login, e o proxy local encaminhou corretamente a chamada de autenticação à API. As configurações do Caddy também foram ajustadas para transmitir o IP confiável do cliente. O envio SMTP real e os ensaios de implantação/recuperação continuam pendentes. Nenhuma conta real ou build foi criado nesta entrega.

## Topologia

Caddy recebe o tráfego e preserva o prefixo `/api`, encaminhando-o para Fastify. As outras rotas seguem para Next.js. O editor n8n usa um segundo subdomínio para evitar conflitos com suas rotas e webhooks.

O PostgreSQL não possui portas públicas em produção e participa de uma rede Docker interna. `dra_app` e `dra_n8n` são usuários sem privilégios administrativos, cada um proprietário de seu próprio banco. O acesso de `PUBLIC` aos bancos é revogado. A API não recebe a senha do n8n. As senhas do administrador PostgreSQL são usadas somente na inicialização e operação do banco.

Os scripts de inicialização do PostgreSQL só rodam com volume vazio. Alterar uma senha no `.env.production` não altera um usuário já criado: fazer rotação no banco e na configuração na mesma manutenção. A API já disponibiliza autenticação e gestão de acessos, descritas em [AUTENTICACAO.md](AUTENTICACAO.md).

Os logs têm rotação; não registramos corpos, cookies, tokens nem URLs das requisições na API. O n8n não salva os dados de execuções por padrão. Ao diagnosticar um fluxo, habilitar retenção apenas de forma controlada e sem dados clínicos reais. A rota readiness indica se a conexão com o banco funciona; não substitui teste de migrações, autenticação e permissões.

## Implantação na VPS Linux

1. Preparar VPS, Docker Engine e plugin Compose; diretório de referência `/opt/dra-luciana`. Liberar SSH com acesso restrito e as portas TCP 80/443 e, opcionalmente, UDP 443. Não publicar 3000, 3001, 5432 ou 5678.
2. Configurar dois registros DNS para a VPS: painel e automação. Se existir AAAA, ele também precisa apontar corretamente. Caddy solicita e renova certificados automaticamente; os dados TLS persistem em volume.
3. Copiar `.env.production.example` para `.env.production`, aplicar `chmod 600` e preencher domínios, e-mail, SMTP e segredos novos de 32 bytes: senhas dos bancos, chave n8n, `BETTER_AUTH_SECRET` e o token reservado à integração n8n. Gerar cada segredo com `openssl rand -hex 32`. Nunca reaproveitar as chaves locais. `DATABASE_URL` nesse arquivo pode usar `postgres` como host; os serviços Compose montam a URL com a senha informada. Não exibir a configuração resolvida sem `--quiet`, pois contém segredos.
4. Definir `APP_VERSION` para uma identificação da entrega e validar:

```bash
docker compose --env-file .env.production -f compose.yaml -f compose.prod.yaml config --quiet
```

5. Criar imagens **somente mediante execução manual autorizada**:

```bash
docker compose --env-file .env.production -f compose.yaml -f compose.prod.yaml build
```

6. Iniciar sem build implícito:

```bash
docker compose --env-file .env.production -f compose.yaml -f compose.prod.yaml up -d --no-build
docker compose --env-file .env.production -f compose.yaml -f compose.prod.yaml ps
```

O serviço `migrate` precisa terminar com sucesso antes da API. Na primeira instalação, criar imediatamente a conta proprietária do n8n, antes de habilitar acesso público ao subdomínio. Até essa configuração, restringir esse acesso na borda ou executar a preparação por túnel SSH. Não cadastrar credenciais clínicas antes de configurar backups e validar restauração.

Verificar `/health`, `/api/v1/health`, `/api/v1/ready` e o estado do n8n. O Compose reinicia processos que terminam; um contêiner marcado como `unhealthy` não reinicia automaticamente. Monitorar esses estados e alertar o responsável pela operação.

## Atualizações e migrations

Fazer backup antes de atualizar. Revisar mudanças de versão e gerar imagens explicitamente. Em uma janela de manutenção, parar frontend, backend e n8n; executar `docker compose ... run --rm --no-deps migrate` com os mesmos arquivos e ambiente de produção. Depois iniciar a entrega com `up -d --no-build`. Se a migration falhar, manter o ambiente em manutenção e revisar o erro antes de subir a API. Rollback de imagem não reverte uma migration; mudanças incompatíveis exigem plano próprio e, se necessário, restauração.

Em desenvolvimento, criar migrations com `pnpm --filter @dra/backend run db:migrate:dev --name nome_da_alteracao`. Usar banco de desenvolvimento e um banco sombra dedicado se o Prisma solicitar; o usuário da aplicação não tem `CREATEDB`. Nunca conceder esse privilégio em produção. O deploy usa apenas `prisma migrate deploy`.

## Backup externo criptografado

A rotina usa [restic](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html) instalado na VPS. Inclui os dois bancos, arquivos persistentes do n8n, configurações/certificados do Caddy, código-fonte e `.env.production` com a chave de criptografia do n8n. A senha do restic deve ficar também em um cofre externo: perdê-la impede restaurar.

1. Instalar restic, criar um bucket/repositório fora da VPS e credenciais próprias. Preencher `/etc/dra/backup.env` a partir de `infra/backup/backup.env.example`. Aplicar permissão 600 nesse arquivo e no arquivo de senha do restic.
2. Exportar as variáveis do arquivo em um terminal administrativo e inicializar o repositório uma única vez com `restic init`.
3. Executar `bash /opt/dra-luciana/infra/backup/backup.sh`. A rotina pausa os serviços, exporta banco e arquivos consistentes e retoma os serviços antes do upload. O diretório temporário tem acesso restrito e é removido ao final. Planejar espaço livre para esse material e uma breve indisponibilidade.
4. Após validar um backup e a restauração, instalar os arquivos `dra-backup.service` e `dra-backup.timer` em `/etc/systemd/system/`, ajustando o caminho se necessário. Executar `systemctl daemon-reload` e `systemctl enable --now dra-backup.timer`. O timer roda diariamente às 03h de São Paulo, com pequena variação.
5. Conferir `systemctl list-timers dra-backup.timer`, `journalctl -u dra-backup.service` e a lista de snapshots. Configurar alerta de falha e de ausência de backup recente no monitoramento da VPS. Esta integração depende do provedor ainda não escolhido.

Retenção: 7 diários, 4 semanais e 6 mensais. O script valida a estrutura do repositório; fazer também `restic check --read-data` periodicamente e ensaiar restauração. O agendamento e envio externo ainda dependem da VPS e do destino contratado.

## Restauração em instalação separada

Executar primeiro em outra VPS ou projeto isolado, com portas e domínios distintos. Nunca conectar a cópia de teste aos recursos reais do WhatsApp, Google ou IA. Bloquear sua saída de rede enquanto os fluxos ativos forem revisados e desativados.

1. Instalar Docker, Compose e restic; recuperar as credenciais do repositório e sua senha do cofre. Listar snapshots com `restic snapshots --tag dra-luciana`. Restaurar o escolhido com `restic restore ID --target /srv/dra-restore`.
2. Encontrar a pasta restaurada `var/tmp/dra-backup.*`. Extrair `source.tar.gz` para o diretório do projeto; recuperar `production.env` como `.env.production`, mantendo permissão 600. Ajustar domínios e nome do projeto para o ambiente isolado.
3. Obter as imagens da versão salva ou construí-las apenas quando solicitado. Iniciar somente PostgreSQL com os mesmos arquivos Compose e `up -d --no-build postgres`. Esperar o banco ficar saudável. Os usuários e bancos serão criados pelas senhas recuperadas.
4. Com os demais serviços parados, restaurar cada arquivo de banco: `docker compose ... exec -T postgres pg_restore -U postgres -d dra_app --exit-on-error < dra_app.dump`; repetir para `n8n.dump` com `-d n8n`. Os bancos devem estar novos e sem migrations aplicadas. Não usar `--clean` contra instalação existente.
5. Criar os contêineres sem iniciá-los usando `docker compose ... create --no-build n8n caddy`. Esse comando também pode criar suas dependências, sem iniciá-las. Copiar **o conteúdo** de `n8n-data/.` para `n8n:/home/node/.n8n/` e de `caddy-data/.` e `caddy-config/.` para `caddy:/data/` e `caddy:/config/` com `docker compose ... cp`. Conferir propriedade e acesso: n8n roda com UID/GID 1000. Usar contêiner temporário com o volume e `chown` se necessário.
6. Em um ensaio, manter n8n sem saída para serviços externos e desativar workflows antes de liberar conectividade. Em recuperação real, confirmar DNS, webhook e que a instância antiga está parada, evitando processamento duplicado.
7. Executar `up -d --no-build`; conferir migrations, readiness e conteúdo. Depois de implementar autenticação, o ensaio também deverá verificar login, roles, sessão persistida e recuperação de credenciais n8n com a chave original. Reiniciar os contêineres e repetir as verificações.
8. Registrar data, snapshot, tempo de recuperação e resultado. A etapa 1 só será aceita após esse ensaio completo, incluindo autenticação.

## Referências técnicas

- [Next.js: estrutura de pastas](https://nextjs.org/docs/app/getting-started/project-structure) e [saída standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
- [Prisma 7: geração do cliente](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/generating-prisma-client).
- [Better Auth: tabelas de autenticação](https://better-auth.com/docs/concepts/database).
- [n8n: Docker Compose](https://docs.n8n.io/deploy/host-n8n/install-options/install-using-docker-compose.md) e [readiness](https://docs.n8n.io/deploy/host-n8n/keep-n8n-running/monitor-n8n.md).
- [Caddy: HTTPS automático](https://caddyserver.com/docs/automatic-https).
