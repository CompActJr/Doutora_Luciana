# Painel da Dra. Luciana

Base inicial do painel definido em [PLANO_DO_PROJETO.md](docs/PLANO_DO_PROJETO.md).

```text
frontend/             Next.js, App Router, TypeScript e Tailwind
backend/              API Fastify, Prisma e migrations
packages/contracts/   Tipos públicos compartilhados entre frontend e API
infra/caddy/          Proxy local e HTTPS em produção
infra/postgres/       Inicialização dos bancos e usuários separados
infra/backup/         Backup com restic e agendamento Linux
n8n/workflows/        Exportações revisadas dos fluxos, ainda pendentes
docs/                 Operação, implantação e restauração
docs/materials/       Contrato e planilha de mensagens de referência
scripts/              Utilitários locais
```

Os logos ficam em `frontend/public/images/logos/`, com nomes em `snake_case`. Os materiais internos em `docs/materials/` não são publicados pelo frontend nem incluídos nas imagens Docker.

## Estado atual

Infraestrutura inicial e autenticação implementadas. O painel possui login, logout, recuperação de senha e administração de acessos. As sessões ficam no PostgreSQL; as permissões são verificadas na API. A página de Respostas ainda é provisória e não há rotas de conteúdo.

Para cadastrar a primeira administradora, após aplicar as migrations: `pnpm run admin:create`. O comando solicita nome, e-mail e senha em um terminal interativo, com senha oculta. Ele só funciona enquanto não houver usuários cadastrados. Não há cadastro público nem credenciais padrão.

As versões dos pacotes são exatas e registradas no `pnpm-lock.yaml`. Os três projetos são definidos em `pnpm-workspace.yaml`, e os contratos locais usam `workspace:*`. As imagens têm tags de versão explícitas. Atualizações de segurança devem ser aplicadas deliberadamente; não há atualização automática de imagens.

## Requisitos

- Node.js 24 LTS e pnpm 12.18.0 para ferramentas locais (versões em `.node-version` e `packageManager`).
- Docker Engine / Docker Desktop com contêineres Linux e Docker Compose v2 ou superior.
- Nenhum build é executado automaticamente. Os comandos de build abaixo são ações manuais.

## Preparação local

Na raiz do repositório:

Com Corepack instalado, `corepack pnpm --version` usa a versão fixada pelo projeto. Se o comando `pnpm` local apontar para outra versão, usar `corepack pnpm` no lugar de `pnpm` nos comandos abaixo. Não é necessário alterar o gerenciador de outros projetos.

```powershell
node scripts/setup-env.mjs
pnpm install --frozen-lockfile
pnpm run db:generate
```

O primeiro comando cria `.env` com segredos diferentes e não sobrescreve um arquivo existente. Não versionar esse arquivo. As senhas geradas são hexadecimais, evitando caracteres que exigem codificação em URLs de banco.

### Desenvolvimento com Docker

A primeira execução exige criar as imagens de desenvolvimento, apenas quando você decidir executar o build:

```powershell
docker compose --env-file .env -f compose.yaml -f compose.dev.yaml build
docker compose --env-file .env -f compose.yaml -f compose.dev.yaml up -d --no-build
```

- Painel e API na mesma origem: `http://localhost:8080` e `http://localhost:8080/api/v1/health`.
- Editor n8n: `http://localhost:5678`. Configurar a conta proprietária antes de cadastrar qualquer integração.
- PostgreSQL: `localhost:5432`, disponível apenas na interface local em desenvolvimento.

As alterações de código são montadas nos contêineres. O pnpm mantém dependências na raiz e em cada workspace; os volumes correspondentes isolam as instalações Linux das instalações do host. Se alterar dependências, atualizar as imagens e os volumes de `node_modules` de forma controlada; não apagar os volumes do PostgreSQL ou n8n. A migração para pnpm usa novos volumes de dependências, sem reutilizar os antigos do npm. Não usar `down -v` para reiniciar o ambiente.

O serviço `migrate` usa uma imagem própria com o schema e as ferramentas Prisma incluídos. Após criar ou alterar migrations, reconstruir essa imagem explicitamente antes de executar o Compose; o código montado no backend não atualiza o conteúdo da imagem de migrations.

### Frontend e API no host

É possível iniciar somente o banco com Docker, sem construir imagens do projeto:

```powershell
docker compose --env-file .env -f compose.yaml -f compose.dev.yaml up -d --no-build postgres
pnpm run db:migrate
pnpm run dev:backend
```

Em outro terminal: `pnpm run dev:frontend`. Nesse modo, frontend e API atendem diretamente em `3000` e `3001`; o proxy com origem única faz parte do modo completo com Docker. Pare o banco se a porta 5432 já estiver ocupada por outra instalação; não reutilize dados de outros projetos.

## Verificações sem build

```powershell
pnpm run db:generate
pnpm run typecheck
pnpm test
pnpm run test:infra
pnpm run db:validate
docker compose --env-file .env -f compose.yaml -f compose.dev.yaml config --quiet
```

Os testes de autenticação com PostgreSQL são executados separadamente com `pnpm run test:integration`. O comando usa o Compose de desenvolvimento, cria um banco temporário com nome exclusivo, aplica migrations e remove esse banco ao final. Exige Docker e o `.env` local configurado; não executa build nem altera os usuários de `dra_app`.

Gerar o cliente Prisma não compila a aplicação. O workspace desabilita scripts de instalação com `ignoreScripts: true`; a geração do Prisma é explícita. Não há scripts `postinstall`, `prepare` ou pipelines que executem build.

Implantação e backups: [docs/INFRAESTRUTURA.md](docs/INFRAESTRUTURA.md).

Configuração de login, SMTP e administração: [docs/AUTENTICACAO.md](docs/AUTENTICACAO.md).

Plano dos testes da etapa 1: [docs/PLANO_VALIDACAO_ETAPA_1.md](docs/PLANO_VALIDACAO_ETAPA_1.md). Evidências e pendências externas: [docs/RESULTADOS_VALIDACAO_ETAPA_1.md](docs/RESULTADOS_VALIDACAO_ETAPA_1.md).
