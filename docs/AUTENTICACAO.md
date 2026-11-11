# Autenticação e administração de acessos

## Implementação

Better Auth 1.7.18 processa login, logout, senhas e sessões na API Fastify, usando o adaptador Prisma e o PostgreSQL. A gestão de usuários é uma parte própria da API: somente `admin` pode criar contas, mudar perfis, bloquear acesso e revogar sessões. `editor` acessa o painel; as operações de conteúdo e publicação serão implementadas na etapa 2.

O cadastro público está desabilitado e somente as rotas de autenticação utilizadas pelo painel são expostas. As senhas usam a função de hash do Better Auth, também usada na criação administrativa. Nunca armazenar ou registrar senhas em texto puro.

Sessões duram até oito horas, com renovação por atividade. O navegador recebe cookies HTTP-only e SameSite=Lax; em produção, os cookies também são Secure. A API consulta o usuário atual no banco para validar o perfil e o bloqueio, sem cache de autorização no cookie. Bloquear uma conta, alterar seu perfil ou revogar suas sessões encerra os acessos anteriores. A API impede que alguém remova o próprio acesso administrativo e preserva uma administradora ativa.

Todas as operações HTTP que alteram estado exigem JSON e a origem exata configurada em `APP_ORIGIN`. A URL do Better Auth é canônica; não é construída com o header Host recebido. O Caddy sobrescreve o header do IP do cliente. A API só o utiliza quando `AUTH_TRUST_PROXY=true`; fora do Compose utiliza o endereço da conexão, ignorando headers de IP fornecidos pelo cliente.

O limite de autenticação persiste na tabela `rateLimit`: até cinco tentativas de login por minuto por IP; até três solicitações de recuperação por minuto por IP. Outros endpoints do Better Auth têm limite geral de 60 por minuto. Esses limites não substituem o monitoramento e a manutenção das versões.

## Ambiente local e primeira administradora

1. Executar `pnpm install --frozen-lockfile` e `pnpm run db:generate`.
2. Se ainda não existir `.env`, executar `node scripts/setup-env.mjs`. Na migração de uma instalação existente, acrescentar `BETTER_AUTH_SECRET` com um segredo aleatório exclusivo de 32 bytes, sem substituir as senhas ou a chave do n8n. O utilitário não sobrescreve arquivos existentes.
3. Iniciar PostgreSQL: `docker compose --env-file .env -f compose.yaml -f compose.dev.yaml up -d --no-build --wait postgres`.
4. Aplicar migrations: `pnpm run db:migrate`.
5. Executar `pnpm run admin:create` em um terminal interativo. Informar nome, e-mail e senha de 12 a 128 caracteres. Não há senha padrão, senha em argumentos da linha de comando ou cadastro automático da doutora. O comando recusa a operação caso já existam usuários.
6. Iniciar API com `pnpm run dev:backend` e frontend com `pnpm run dev:frontend`. Abrir **http://localhost:3000/login**, usando `APP_ORIGIN=http://localhost:3000`. O Next.js encaminha `/api` para a API local. Usar exatamente esse endereço, pois a origem `http://127.0.0.1:3000` é diferente.
7. Após entrar como administradora, acessar **Usuários** para cadastrar a equipe. O perfil padrão é `editor`. Compartilhar senhas iniciais por um canal seguro. Para redefinição individual, configurar SMTP e usar a recuperação de acesso.

No modo completo com Compose, o endereço é **http://localhost:8080** e a origem da API é ajustada pelo override de desenvolvimento. Criar as imagens somente quando um build for expressamente solicitado. A configuração de produção usa `https://PANEL_DOMAIN`, com acesso externo à API somente pelo Caddy.

Na primeira implantação em Docker, a criação inicial pode ser executada com:

```bash
docker compose --env-file .env.production -f compose.yaml -f compose.prod.yaml run --rm --no-deps migrate pnpm run admin:create
```

Executar depois das migrations, em terminal interativo, com a imagem de migrations já disponível. O comando utiliza o banco e não precisa abrir uma rota de cadastro na internet.

## SMTP e recuperação de senha

Preencher as variáveis no `.env` local ou `.env.production` da VPS:

| Variável | Uso |
|---|---|
| `BETTER_AUTH_SECRET` | Segredo exclusivo da autenticação, com pelo menos 32 caracteres |
| `APP_ORIGIN` | Origem exata do painel; HTTPS em produção |
| `SMTP_HOST` | Servidor do provedor de e-mail |
| `SMTP_PORT` | Geralmente 587 com STARTTLS ou 465 com TLS direto |
| `SMTP_SECURE` | `false` para STARTTLS; `true` para TLS direto |
| `SMTP_USER` e `SMTP_PASSWORD` | Credenciais do provedor, quando exigidas |
| `SMTP_FROM` | Remetente autorizado pelo provedor |

O transporte exige TLS, valida certificados e não registra conteúdo dos e-mails. O formulário apresenta a mesma confirmação para endereços cadastrados e inexistentes. O link expira em 30 minutos, só pode ser utilizado uma vez e a redefinição revoga as sessões anteriores. Os tokens não são exibidos em logs nem em uma tela de desenvolvimento.

Sem servidor e remetente configurados, a recuperação retorna indisponibilidade para qualquer e-mail. Não existe envio simulado apresentado como envio real. O envio e a entrega com o provedor ainda precisam ser validados quando as credenciais estiverem disponíveis. A suíte de autenticação usa transporte em memória; a suíte `test:smtp` valida adicionalmente a transmissão real por STARTTLS ao capturador local, sem mensagens externas.

`N8N_SERVICE_TOKEN` é um segredo separado reservado para a integração da etapa 3. Ainda não há endpoint de conteúdo para esse token. Não reutilizar senha de usuário, `BETTER_AUTH_SECRET` ou a chave de criptografia do n8n como credencial de serviço.

## Rotas

| Rota | Acesso |
|---|---|
| `/api/v1/auth/sign-in/email` e `/sign-out` | Login e logout via Better Auth |
| `/api/v1/auth/request-password-reset` e `/reset-password` | Recuperação e redefinição |
| `/api/v1/auth/get-session` e `/change-password` | Sessão e alteração autenticada de senha |
| `GET /api/v1/me` | Qualquer pessoa com sessão ativa |
| `GET /api/v1/users` | Admin; lista até 200 contas |
| `POST /api/v1/users` | Admin; cadastra pessoa com senha inicial |
| `PATCH /api/v1/users/:id` | Admin; muda perfil ou bloqueio |
| `POST /api/v1/users/:id/revoke-sessions` | Admin; encerra sessões |

O link de recuperação também usa `GET /api/v1/auth/reset-password/:token` para redirecionar à página de nova senha. As páginas protegidas verificam a sessão no servidor; a API faz sua própria verificação em todas as operações.

## Verificação

```bash
pnpm run typecheck
pnpm test
pnpm run test:infra
pnpm run test:integration
pnpm run test:smtp
```

A integração cria um banco PostgreSQL temporário e verifica cadastro público bloqueado, hash de senha, login inválido, cookies, sessão persistida, controle de perfil, proteção de origem, revogação, bloqueio de contas, recuperação, token expirado/reutilizado e limite por IP mesmo com headers falsificados. Nenhum usuário de produção é criado pelos testes.

`pnpm run test:smtp` acrescenta um teste com transmissão SMTP real para um capturador Mailpit local, em projeto Docker separado. Requer OpenSSL (o script também encontra a instalação padrão do Git no Windows). O teste gera um certificado local em `backups/validation/smtp-certs`, confia nele somente para os processos de teste e exige STARTTLS. A conexão sem essa confiança deve falhar. A mensagem usa destinatário fictício, e seu link é usado para redefinir a senha e verificar o login. O capturador e o banco temporário são removidos ao final; nenhum e-mail é encaminhado para a internet e nenhuma autoridade certificadora é instalada no sistema operacional.

Builds, entrega real de e-mail, HTTPS com domínio contratado e recuperação completa da VPS continuam sujeitos às validações de implantação descritas em [INFRAESTRUTURA.md](INFRAESTRUTURA.md).

Referências: [integração Fastify](https://better-auth.com/docs/integrations/fastify), [adaptador Prisma](https://better-auth.com/docs/adapters/prisma), [senhas](https://better-auth.com/docs/authentication/email-password) e [limitação de tentativas](https://better-auth.com/docs/concepts/rate-limit).
