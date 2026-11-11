# Resultados da validação da etapa 1

Data: 10/11/2026, horário de Brasília. Plano: [PLANO_VALIDACAO_ETAPA_1.md](PLANO_VALIDACAO_ETAPA_1.md).

## Condições desta rodada

- Builds locais autorizados explicitamente pelo usuário e executados no Docker Desktop, sem publicação.
- Ambiente `dra-dev` preservado: a contagem e a impressão de identificadores, e-mails, perfis e bloqueios da conta existente permaneceram iguais antes e depois dos testes. Uma administradora, sem redefinição de senha real.
- Projetos `dra-validation` e `dra-restore` com bancos, volumes e contas fictícias próprios. Projetos Supabase de outros trabalhos não foram alterados.
- SMTP por Mailpit local, conforme autorizado; nenhum e-mail externo. Segredos e evidências privadas ignorados pelo Git.

## Resultados

| Verificação | Evidência |
|---|---|
| Tipagem e schema | Três workspaces aprovados; `prisma validate` aprovado |
| Testes básicos | Um teste de geração de segredos, quatro de API/configuração e dois de topologia Compose aprovados |
| Autenticação em PostgreSQL temporário | 12 cenários aprovados: login/logout, roles, bloqueio, revogação, origem, limite por IP, cookies e recuperação com tokens expirados/reutilizados |
| SMTP | Suíte com SMTP: 14 testes aprovados, incluindo agrupamento; mensagem recebida por STARTTLS, link utilizado, senha nova aceita e antiga rejeitada |
| Confiança TLS do SMTP | Certificado rejeitado sem a CA local e aceito com confiança limitada ao processo de teste; validação TLS ativa |
| Docker de desenvolvimento | PostgreSQL, migrations, backend, frontend, n8n e Caddy iniciados; quatro healthchecks aprovados e proxy funcionando |
| Imagens de produção | Backend compilado, Next.js standalone e migrador funcionando sem montagem do código; backend/frontend como `node`, com capabilities removidas |
| HTTPS local | CA interna do Caddy confiada explicitamente pelo cliente; painel e n8n respondendo nas portas de ensaio |
| Navegação e permissões | Admin lista usuários e acessa administração; editor recebe 403 da API e redirecionamento da página administrativa; ambos acessam Respostas |
| Proteção HTTP | Cookies Secure, HttpOnly e SameSite=Lax; origem hostil rejeitada; anônimos bloqueados; logos acessíveis, `.env` e documento interno retornando 404 |
| Persistência | Sessões, usuários, migrations e arquivo n8n preservados após parada/inicialização e recriação dos contêineres sem remover volumes |
| Separação PostgreSQL | `dra_app` sem acesso ao banco `n8n`; `dra_n8n` sem acesso ao banco `dra_app` |
| Backup real | `infra/backup/backup.sh` executado com restic 0.19.1; snapshot `a31be101`, cerca de 1,37 MiB, com dois dumps, dados/configuração n8n e Caddy, ambiente e fonte |
| Integridade e criptografia | `restic check --read-data` aprovado; senha incorreta recusada; fonte arquivada sem `.env`, backups, `.git` ou dependências |
| Recuperação completa | Dois bancos restaurados em volumes novos; configuração recuperada do snapshot; CA original idêntica e arquivo persistente recuperado |
| Uso após recuperação | Sessões do backup e novos logins admin/editor aceitos; permissões preservadas; dois usuários e duas migrations recuperados |
| Chave n8n | Credencial fictícia cifrada e decifrada pelo CLI oficial no ambiente restaurado; conteúdo comparado em memória, sem exibir o valor |
| Isolamento do ensaio | Nenhum workflow importado; n8n de ensaio/restauração somente em redes internas, sem ações externas |
| Logs | Segredos e cookies usados no ensaio não encontrados nos logs dos cinco serviços; não representa auditoria de todos os caminhos futuros |
| Falhas de backup | Senha incorreta retornou erro com serviços retomados; falha de `pg_dump` injetada após pausa acionou o `trap`, que também retomou os serviços |

O Caddy não possui healthcheck próprio no Compose: foi verificado por requisições reais ao painel, API e n8n. O estado `running` isoladamente não comprova funcionamento do proxy.

## Correções feitas

- OpenSSL e certificados de CA incluídos nas imagens do backend para as ferramentas Prisma.
- Schema engine e cliente Prisma incluídos no build do migrador, evitando download pela rede interna sem internet.
- Migrador de desenvolvimento com imagem própria. Alterações de migrations exigem build explícito dessa imagem.
- PostgreSQL de desenvolvimento recriado com o mesmo volume para recuperar o alias DNS `postgres`, ausente na ligação preexistente. Conta existente intacta.
- Backup aceita parâmetros de projeto Compose, ambiente e overrides; padrões de operação na VPS preservados.
- Restauração corrigida: `docker compose create` não aceita `--no-deps` nesta versão. As dependências são criadas sem iniciar.
- Porta de restauração alterada para 20443 porque 19443 estava ocupada por outro serviço do computador, que foi preservado.

## Pendências externas

Acompanhamento separado por etapa em [PENDENCIAS_DE_TESTE.md](PENDENCIAS_DE_TESTE.md).

| Item | O que falta |
|---|---|
| VPS | Provisionar, configurar acesso/firewall, implantar e medir recursos |
| DNS e HTTPS público | Apontar domínios, emitir/renovar certificados ACME e testar acesso externo |
| E-mail externo | Configurar provedor/remetente e testar entrega; o `.env` de uso normal continua sem SMTP |
| Backup fora da máquina | Configurar destino externo e testar envio/recuperação nesse destino |
| Agendamento e alertas | Instalar restic, segredos, service/timer systemd e alertas; observar execução agendada |

Service/timer revisados e sintaxe Bash validada; systemd não executado no Windows. O restic deste ensaio usa volume local e não protege contra perda do computador. Certificado local não comprova ACME público. Avisos de depreciação do n8n e consultas externas bloqueadas no ensaio não impediram os testes; revisar a configuração ao atualizar a versão.

Os requisitos de aceite da etapa 1 foram comprovados localmente: login/permissões, persistência e restauração independente. O aceite operacional de produção depende dos itens externos acima.

## Repetição e recursos

Roteiro: [ENSAIO_LOCAL_ETAPA_1.md](ENSAIO_LOCAL_ETAPA_1.md). Verificações básicas:

```bash
pnpm run typecheck
pnpm run db:validate
pnpm test
pnpm run test:infra
pnpm run test:integration
pnpm run test:smtp
```

Os testes de integração removem seus bancos temporários; o SMTP também remove o capturador. Os contêineres de ensaio são encerrados ao final, preservando volumes e o repositório `dra-validation-backups` para inspeção. Desenvolvimento disponível em `http://localhost:8080`, com n8n em `http://localhost:5678`.
