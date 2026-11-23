# AGENTS.md — Painel da Dra. Luciana

Referência de contexto e orientação para agentes que trabalham neste repositório.
Mapeamento inicial: **11/11/2026**, com base na documentação, no código, no contrato e na planilha existentes.
Atualização no mesmo dia: primeiro incremento da etapa 2 implementado; detalhes e evidências em [docs/ETAPA_2_CONTEUDO.md](docs/ETAPA_2_CONTEUDO.md).
Segundo incremento no mesmo dia: Base de conhecimento e Assistente implementadas; referência em [docs/CONHECIMENTO_ASSISTENTE.md](docs/CONHECIMENTO_ASSISTENTE.md).
Terceiro incremento no mesmo dia: versões imutáveis, ativação/restauração interna, simulador, sugestões editáveis OpenAI e OpenAPI implementados. Estado atual e evidências em [docs/VERSOES_SIMULADOR_IA.md](docs/VERSOES_SIMULADOR_IA.md). Importador da planilha retirado do escopo por esclarecimento do usuário: era material inicial de exemplo, sem requisito de importação pelo painel.
Prioridade atual, no mesmo dia: usuário adiou WhatsApp/n8n (etapa 3) e antecipou integração Google Agenda no painel. Implementação direta API/Google e página `/agenda`, independente de IA; conexão real/aceite pendentes. Referência em [docs/AGENDA_GOOGLE.md](docs/AGENDA_GOOGLE.md).

Interface atualizada em **12/11/2026** com base no HTML do protótipo fornecido pelo usuário: editores em duas colunas, Assistente em cinco etapas, agenda por horários e navegação inferior no celular com `/mais`. Referência, limites e verificações em [docs/INTERFACE_REFERENCIA.md](docs/INTERFACE_REFERENCIA.md). Tratar o HTML somente como material visual; não importar seu runtime nem assumir conexões a partir dos exemplos.

Preparação da etapa 3 retomada pelo usuário em **13/11/2026**: recebidos os oito workflows da equipe, com originais preservados em `backups/workflow-intake/2026-11-13/` e cópias revisadas em `n8n/workflows/equipe/`. Importadas no n8n local como `[BASE BLOQUEADA]`, sem credenciais, inativas e com entradas/ações externas bloqueadas. Não há integração funcional com o painel ou atendimento ativado. Diagnóstico e sequência em [docs/INTEGRACAO_N8N.md](docs/INTEGRACAO_N8N.md).

## Como usar este arquivo

- Leia este arquivo ao iniciar uma tarefa e consulte os documentos específicos indicados abaixo conforme a área afetada.
- Separe objetivo do produto, funcionalidade implementada e validação realizada. Uma tela provisória ou infraestrutura disponível não comprova uma integração funcionando.
- As instruções atuais do usuário prevalecem sobre orientações deste arquivo. Em `frontend/`, leia também [frontend/AGENTS.md](frontend/AGENTS.md), que contém instruções específicas do Next.js.
- Este arquivo resume o projeto; os detalhes de operação e as evidências continuam nos documentos de `docs/`. Há registros históricos em `INFRAESTRUTURA.md` e `AUTENTICACAO.md`: para o resultado da rodada de 10/11/2026, consulte o relatório de resultados; para pendências, consulte o acompanhamento atualizado em 11/11/2026.
- Confirme o estado do código e dos arquivos de configuração antes de alterar algo. Este mapeamento não representa uma inspeção permanente dos serviços em execução.

## O projeto e o resultado esperado

O **Painel da Dra. Luciana** é uma aplicação privada para a clínica odontológica gerenciar o conteúdo e o comportamento de sua assistente de atendimento com IA no WhatsApp.

A clínica deve conseguir **editar respostas, ajustar a assistente, simular conversas e publicar alterações sem reprogramar o workflow do n8n**. O projeto atende exclusivamente à Dra. Luciana; não há requisito de plataforma para múltiplas clínicas.

Os perfis definidos são:

| Perfil | Responsabilidade prevista |
|---|---|
| `admin` — doutora/administradora | Editar, simular, publicar, restaurar versões e administrar acessos |
| `editor` — equipe | Editar conteúdo e simular, sem publicar ou administrar acessos |

A gestão de respostas foi a prioridade inicial. Por instrução atual do usuário, Google Agenda manual foi antecipado e WhatsApp/n8n adiados. Lembretes e agendamento automático por IA continuam para outra entrega. A IA/simulador não consultam a agenda neste incremento; mantenha encaminhamento/link aprovado e não prometa horários não consultados.

Referência funcional principal: [docs/PLANO_DO_PROJETO.md](docs/PLANO_DO_PROJETO.md). O contrato fundamenta o escopo contratado; não é conteúdo de conhecimento do bot.

## Estado comprovado no repositório

| Área | Situação no mapeamento inicial |
|---|---|
| Etapa 1 — infraestrutura, banco e autenticação | Implementada e validada localmente, com evidências em 10/11/2026 |
| Operação em produção | Pendente de VPS, DNS/HTTPS público, SMTP externo, backup externo, agendamento e alertas |
| Etapa 2 — painel de conteúdo | Editores, versões, ativação/restauração interna, simulador, sugestões por OpenAI e OpenAPI implementados; conexão real OpenAI e revisão clínica pendentes |
| Etapa 3 — n8n, IA e WhatsApp | Preparação retomada em 13/11: oito exports da equipe revisados/importados, inativos e bloqueados; API de serviço, resposta compartilhada e integração real pendentes |
| Google Agenda | Antecipado: OAuth, seleção, visualização e gestão manual implementados; credenciais, conexão real e aceite pendentes |

**Já existe:**

- Monorepo pnpm com frontend, API e contratos públicos compartilhados.
- Docker Compose para desenvolvimento, produção e ensaios isolados, PostgreSQL, Caddy, n8n e migrador Prisma.
- Login/logout, recuperação/redefinição de senha, sessões no PostgreSQL e páginas protegidas.
- Gestão administrativa de usuários: criação, alteração de perfil, bloqueio e revogação de sessões.
- Healthchecks, testes de autenticação/SMTP e ferramentas de backup e restauração.
- Validação local registrada de imagens de desenvolvimento/produção, HTTPS local, permissões, persistência e recuperação completa em instalação independente.
- Biblioteca de Respostas para admin/editor: busca, categorias textuais, filtros e paginação, criação, edição, revisão, duplicação e desativação/reativação; prévia demonstrativa sem IA ou envio.
- Controle de revisão para impedir sobrescrita concorrente e avisos de alterações não salvas. Publicação para WhatsApp desabilitada, sem endpoint de publicação.
- Base de conhecimento em `/conhecimento`: cadastro, busca, filtros, revisão, edição e desativação/reativação de informações. Configuração única em `/assistente`: apresentação, tom, limites, encaminhamento e agendamento; GET sem cadastro retorna nulo, sem criar dados.
- A pedido do usuário, o desenvolvimento foi preenchido com 7 respostas e 5 informações `[EXEMPLO]` em revisão e uma configuração demonstrativa da assistente. `pnpm run demo:seed` é manual, somente local e idempotente; não sobrescreve conteúdo existente nem é executado ao iniciar a aplicação. Esses exemplos precisam de revisão clínica e não foram publicados.
- Versões em `/configuracoes/versoes`: cópia completa imutável, ativação transacional e restauração em nova versão por admin; editor consulta/simula. Não altera WhatsApp ou rascunhos existentes. Itens ativos precisam estar revisados antes da ativação interna.
- Simulador em `/simulador`, com conversas persistidas privadas por usuário e conteúdo fixo por conversa. Modos demonstrativo sem IA e OpenAI explícitos. Até 50 testes/usuário e 20 perguntas/conversa, com revisão, idempotência e trava de processamento.
- Sugestões de variações OpenAI editáveis, sem salvamento automático. Adaptador Responses configurável somente no backend por `OPENAI_API_KEY` e `OPENAI_MODEL`; ambos ausentes no desenvolvimento. Testes usam provedor fictício isolado, sem chamadas pagas. Integrações em `/configuracoes/integracoes` e OpenAPI autenticada em `/api/v1/openapi.json`.
- Agenda em `/agenda`, exclusiva de admin: conexão OAuth Google com PKCE/state, seleção de agenda editável/fuso, vistas dia/semana/mês, criação/reagendamento/cancelamento manual. Fonte dos eventos é Google, sem cópia local de dados clínicos. Eventos de dia inteiro/especiais/com convidados são somente leitura; ocorrências recorrentes são tratadas individualmente.
- Credenciais Google exclusivamente no backend: `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_TOKEN_KEY` (64 hex, chave própria AES-256-GCM). Sem configuração, mostrar somente indisponibilidade; orientações técnicas ficam na documentação interna. Nunca simular autorização ou horários reais. Fixtures de teste isoladas não comprovam conexão externa.
- Ajuste de experiência em 12/11/2026: configuração Google Cloud é responsabilidade da equipe técnica e fica somente na documentação interna. Não mostrar tutorial técnico, link do console ou URI OAuth para a doutora. Na interface, apresentar disponibilidade e as ações de conectar conta/selecionar agenda; sem configuração, apenas indicar indisponibilidade.

**Ainda não existe:** cadastro separado de categorias (categorias continuam textuais), consulta autenticada pelo n8n, rotina de resposta integrada ao painel e compartilhada com o simulador, publicação para WhatsApp ou conexão externa OpenAI validada. O pacote da equipe já tem subworkflows próprios, mas não está integrado ao painel. Importador de planilha não é requisito atual. Conhecimento e configurações salvos ainda não orientam um bot de produção.

O schema Prisma contém autenticação, `ResponseTemplate`, `KnowledgeEntry`, `AssistantSettings`, `ContentVersion`, `ContentRelease`, `Simulation`, `AiRequestWindow` e os enums `Role`/`ResponseReviewStatus`. A terceira migration, `20261111000100_response_drafts`, acrescenta os rascunhos de respostas. Um modelo revisado só integra uma versão ativa após a ação explícita de admin.

A quarta migration, `20261111000200_knowledge_assistant`, acrescenta `KnowledgeEntry` e `AssistantSettings`. Conhecimento reutiliza o enum editorial existente. Assistente usa ID fixo `clinic`, criado apenas ao salvar com revisão 0; atualizações exigem a revisão atual. A migration é aditiva e não altera registros anteriores.

A quinta migration, `20261111000300_versions_simulation`, acrescenta versões completas, ponteiro interno ativo, conversas de teste e quota de IA, com relações e trigger PostgreSQL contra alteração/exclusão de versões. Aplicada pelo host no desenvolvimento, sem build. Ao reabrir uma versão/conversa, respeite `schemaVersion: 1` e preserve a cópia fixa. Restauração não modifica rascunhos.

A sexta migration, `20261111000400_google_calendar`, acrescenta `CalendarConnection` e `CalendarOAuthState`, sem alterar registros anteriores. Não usar `Account` do Better Auth para tokens Google da agenda. Refresh token e verificador OAuth ficam cifrados com chave própria; access token não é persistido nem retornado ao cliente. Preserve revisão/geração da conexão, etags Google e idempotência da criação.

O relatório registra uma administradora existente no desenvolvimento. Preserve contas e senhas reais; não execute o bootstrap como se o projeto estivesse vazio. Os resultados anteriores são evidências históricas, não testes executados automaticamente a cada tarefa.

## Mapa do repositório

| Caminho | Conteúdo e ponto de entrada |
|---|---|
| `frontend/src/app/` | Next.js App Router; `/` redireciona para `/respostas`; grupos `(auth)` e `(painel)` |
| `frontend/src/app/(auth)/` | `/login`, `/recuperar-senha` e `/redefinir-senha` |
| `frontend/src/app/(painel)/` | Layout autenticado, biblioteca de Respostas e `/configuracoes/usuarios` |
| `frontend/src/components/` | Formulários de autenticação, logout e administração de usuários |
| `frontend/src/components/responses/` e `panel/` | Biblioteca/editor/prévia e navegação do painel |
| `frontend/src/app/(painel)/mais/` | Conta, saída e atalhos de configurações/agenda no celular; links administrativos conforme o perfil |
| `frontend/src/components/knowledge/` e `assistant/` | Editores de conhecimento e configuração da assistente; proteção contra edições concorrentes e prévias estáticas |
| `frontend/src/lib/api.ts` | Chamadas do navegador para `/api/v1`, com credenciais da mesma origem |
| `frontend/src/lib/session.ts` | Consulta de sessão no servidor e proteção de páginas com `requireUser` |
| `frontend/src/app/globals.css` | Tokens visuais e estilos compartilhados |
| `frontend/public/images/logos/` | Logos oficiais em PNG, com nomes em `snake_case` |
| `backend/src/app.ts` | Fábrica Fastify, saúde, erros e registro de rotas; permite testes com injeção |
| `backend/src/server.ts` | Configuração dos serviços, conexão com banco e encerramento dos processos |
| `backend/src/config/env.ts` | Validação de ambiente com Zod |
| `backend/src/modules/auth/` | Better Auth, adaptação de rotas HTTP, sessão, autorização e envio SMTP |
| `backend/src/modules/users/` | Criação de usuários e bootstrap interativo da primeira administradora |
| `backend/src/modules/responses/` | API dos rascunhos, registrada no escopo protegido de autenticação |
| `backend/src/modules/knowledge/`, `assistant/` e `content/` | APIs de conhecimento/configuração e validação compartilhada, no mesmo escopo protegido |
| `backend/src/modules/ai/` e `simulation/` | Adaptador Responses, seleção textual e conversas privadas de teste; nenhuma ferramenta de ação externa |
| `backend/src/modules/calendar/` | OAuth Google, cifra, fuso, cliente HTTP, contratos OpenAPI e gestão manual de consultas; somente admin |
| `frontend/src/components/calendar/`, `frontend/src/app/(painel)/agenda/` e `frontend/src/lib/calendar.ts` | Conexão e agenda da administradora, calendário responsivo e editor manual |
| `frontend/src/components/content/` e `simulator/` | Versões, estado de integrações e simulador; rotas em `/configuracoes/versoes`, `/configuracoes/integracoes` e `/simulador` |
| `backend/src/plugins/database.ts` | Prisma com adaptador PostgreSQL |
| `backend/prisma/` e `backend/prisma.config.ts` | Schema, migrations e configuração Prisma 7 |
| `backend/tests/` | Testes básicos, integração com banco/SMTP e fixture exclusiva de validação |
| `packages/contracts/src/index.ts` | Tipos públicos de saúde, prontidão, usuários, sessão e modelos de resposta |
| `compose*.yaml` | Serviços base e overrides de desenvolvimento, produção, validação e restauração |
| `infra/caddy/` e `infra/postgres/` | Proxy e inicialização de bancos/usuários separados |
| `infra/backup/` | Backup restic, exemplo de configuração e service/timer systemd |
| `infra/testing/` | Capturador SMTP, HTTPS local e auxiliares de backup/restauração |
| `scripts/` | Preparação de ambientes e runners de integração, validação HTTP e restauração |
| `scripts/testing/design-browser-checks.mjs` | Verificações dos fluxos e responsividade do protótipo; acionadas por `test:design:browser`, com banco e contas fictícios |
| `n8n/workflows/` | Oito exports revisados em `equipe/`, inventário/IDs e orientações; cópias bloqueadas importadas no n8n local, sem integração funcional ou ativação |
| `docs/` e `docs/materials/` | Planejamento, operação, evidências, contrato e planilha de mensagens |
| `backups/` | Artefatos locais privados de ensaio, ignorados pelo Git |

## Arquitetura e convenções técnicas

- Node.js **24.22.2** em `.node-version` e Dockerfiles; pnpm **12.18.0** em `packageManager`. Verifique esses arquivos se as versões mudarem.
- Frontend: Next.js **16.4.5**, React **19.3.1**, TypeScript e Tailwind **4.3.5**. shadcn/ui está previsto no planejamento, mas ainda não foi instalado.
- Backend: Fastify **5.12.8**, Prisma **7.10.1**, Better Auth **1.7.18**, Zod e Nodemailer; TypeScript estrito e módulos ESM. Imports locais do backend usam extensão `.js`.
- Infraestrutura fixada no Compose: PostgreSQL **17.11**, n8n **2.46.6** e Caddy **2.11.9**. As versões citadas são as do repositório, não uma indicação das versões mais recentes disponíveis.
- Use pnpm, os workspaces existentes e o único `pnpm-lock.yaml`. Dependências internas usam `workspace:*`; preserve versões exatas. Não introduza outro gerenciador ou lockfile.
- `@dra/contracts` exporta atualmente somente tipos TypeScript. Compartilhe contratos públicos com `import type`; mantenha modelos internos e segredos fora desse pacote.
- As regras de negócio e permissões pertencem à API; o n8n coordena a automação. Não mover a regra de publicação para o frontend ou para conteúdo fixo do workflow.
- A API usa `/api/v1`. Caddy preserva o prefixo `/api`; frontend e API ficam na mesma origem. No host, o Next.js faz rewrite de `/api` apenas em desenvolvimento.
- Antes de escrever código Next.js, siga `frontend/AGENTS.md` e consulte os guias pertinentes em `frontend/node_modules/next/dist/docs/`. Preserve o bloco gerado pelo Next.js.
- `backend/src/generated/prisma/`, `.next/`, `dist/` e dependências são artefatos gerados. Altere as fontes e gere o cliente quando necessário, sem editar ou versionar esses artefatos.

## Regras de autenticação que devem ser preservadas

- Sem cadastro público ou credenciais padrão. `pnpm run admin:create` exige terminal interativo e banco sem usuários; a senha fica oculta. Depois disso, contas são criadas pela administração.
- Valide sessão, perfil e bloqueio na API em cada operação protegida. O redirecionamento de página e a ocultação de botões complementam essa autorização.
- Senhas de 12 a 128 caracteres são processadas pelo hash do Better Auth. Sessões ficam no banco, com duração de até oito horas e renovação por atividade.
- Cookies são HttpOnly e SameSite=Lax, também Secure em produção. A origem de operações de navegador que alteram estado deve corresponder exatamente a `APP_ORIGIN`, com corpo JSON.
- Alterar perfil, bloquear acesso ou revogar sessões encerra os acessos anteriores. Preserve a proteção do próprio acesso administrativo e de pelo menos uma administradora ativa.
- Preserve limites persistidos de tentativas e a confiança restrita no IP transmitido pelo Caddy. Não confiar livremente em Host ou headers de encaminhamento enviados pelo cliente.
- Recuperação usa SMTP com TLS e certificado validado. Link expira em 30 minutos, é de uso único e revoga sessões ao redefinir a senha. Sem SMTP, indicar indisponibilidade; não simular envio bem-sucedido.
- `N8N_SERVICE_TOKEN` é uma credencial separada, reservada à etapa 3; ainda não é consumida por um endpoint. Não reutilizar segredos de sessão, senhas ou `N8N_ENCRYPTION_KEY` nessa integração.

Saúde: frontend em `GET /health`; API em `GET /api/v1/health` e `GET /api/v1/ready`. Rotas de acesso atuais: `/api/v1/auth/*` com lista explícita de operações permitidas, `/api/v1/me`, `/api/v1/users`, `/api/v1/users/:id` e revogação em `/api/v1/users/:id/revoke-sessions`. Detalhes em [docs/AUTENTICACAO.md](docs/AUTENTICACAO.md).

Conteúdo: listagem/criação em `/api/v1/responses`, detalhe/edição em `/api/v1/responses/:id` e cópia em `/api/v1/responses/:id/duplicate`. Admin/editor podem gerenciar esses rascunhos; mutações de modelos existentes exigem a revisão atual. Consulte os contratos e [docs/ETAPA_2_CONTEUDO.md](docs/ETAPA_2_CONTEUDO.md) para limites e respostas HTTP.

Conhecimento usa `/api/v1/knowledge` e `/api/v1/knowledge/:id` (GET/POST/PATCH conforme a rota). Assistente usa GET/PUT em `/api/v1/assistant-settings`, sem cadastro automático por GET. São rascunhos acessíveis a admin/editor; salvar não publica. Limites e testes em [docs/CONHECIMENTO_ASSISTENTE.md](docs/CONHECIMENTO_ASSISTENTE.md).

## Comportamento a implementar nas próximas etapas

### Painel e conteúdo — etapa 2

- Áreas: **Respostas**, **Simulador**, **Base de conhecimento**, **Assistente** e **Configurações**. Respostas é a página inicial.
- Modelos: buscar, categorizar, criar, editar, duplicar e desativar. Campos previstos: título, categoria, exemplos de perguntas, resposta-base, variações e estado de revisão.
- Editor desktop com lista, formulário e prévia de conversa; no celular, dividir essas áreas em abas. Ações principais: **Salvar rascunho**, **Simular** e **Publicar**.
- Atualização visual de 12/11/2026: desktop usa lista e editor, com prévia sob demanda. Celular abre o editor a partir da lista, oferece retorno e abas Editar/Prévia. A navegação global fica na barra inferior; `/mais` agrupa configurações, conta e saída. Assistente usa cinco etapas sem salvamento automático.
- Sugestões de variações por IA devem ser editáveis e permanecer como rascunhos.
- Rascunhos não alteram conteúdo em uso. Cada publicação gera uma versão imutável da configuração completa, ativada em transação. Restaurar cria uma nova publicação baseada na versão escolhida.
- Aplicar na API a distinção entre editar/simular e publicar/restaurar.
- Histórico, versões e ativação/restauração interna já implementados; manter a distinção entre ativação no painel e publicação real no WhatsApp, ainda bloqueada.
- Enquanto a integração real não existir, identificar simulações demonstrativas e manter desabilitada a publicação para WhatsApp.
- Incluir persistência, acessibilidade por teclado, rótulos e estados de carregamento, erro e alterações não salvas.

### Automação — etapa 3

**Preparação retomada pelo usuário em 13/11/2026**, ao fornecer os workflows da equipe. A importação local é uma base de estudo, sem ativação de WhatsApp ou agenda automática. Não ativar essas ações como consequência da importação ou da agenda manual.

- Inspecionar/preservar o workflow atual antes de alterá-lo. A exportação da equipe recebida em 13/11 está preservada somente em diretório privado ignorado; as cópias versionáveis foram sanitizadas e bloqueadas. Não importar originais diretamente nem remover bloqueios para testar com pacientes. Consulte `docs/INTEGRACAO_N8N.md` antes de adaptar os fluxos.
- Fluxo previsto: WhatsApp recebe mensagem → n8n consulta versão publicada, contexto e conteúdos relevantes na API → IA responde → fluxo envia e registra a versão utilizada.
- Simulador e WhatsApp devem reutilizar o mesmo subworkflow de resposta. O simulador bloqueia envios e ações externas pela implementação e mantém conversas de teste separadas das reais.
- Começar com busca textual, exemplos de perguntas e contexto mínimo; banco vetorial não é requisito inicial. Respostas curtas como “Sim” dependem da pergunta anterior.
- Tratar falhas, mensagens repetidas e retentativas sem envio duplicado. A equivalência entre simulador e bot é de comportamento/conteúdo, sem exigir texto idêntico da IA.
- Usar a API oficial do WhatsApp, primeiro com recursos de teste da Meta. Preservar o número e o aplicativo atuais; confirmar coexistência antes de mudanças na conta. Ativação depende de revisão dos conteúdos pela doutora e validação da conexão oficial.
- n8n será hospedado na VPS. WhatsApp e serviço de IA são externos. Google Agenda, OAuth, gestão de horários e lembretes exigem uma entrega própria.

## Identidade visual e materiais

- O código atual do painel foi atualizado para marinho, branco e dourado, com superfícies de vidro (`--glass`, `--text`, `--gold` em `globals.css`). Preserve esse visual existente nas novas telas; as referências claras abaixo descrevem o planejamento inicial e não autorizam reverter mudanças atuais do usuário.

- Interface em português brasileiro, com textos funcionais e diretos (sem frases motivacionais). Desde 11/11/2026 o painel usa tema escuro com glassmorphism, aprovado a partir do protótipo no Claude Design.
- O HTML exportado pelo usuário foi aplicado à interface em 12/11/2026. Preserve navegação inferior/Mais no celular, configurações agrupadas no desktop e prévias sob demanda; não reintroduzir toda a lateral no topo do celular. Evidências: typecheck aprovado e ensaios de navegador com 9 verificações da interface, 14 da etapa 2 e 14 da agenda, todos com provedores fictícios. Relatório em `docs/INTERFACE_REFERENCIA.md`.
- Tokens em `globals.css`: fundo marinho `#0a1c2e` com brilhos dourado/azul, marinho da logo `#183450`, dourado `#e4b03a` para ação principal e item ativo, dourado claro `#f2cf7a` para texto dourado, branco para texto e prévias de conversa, `#a9b8c8` para texto de apoio. Painéis de vidro com branco a 6%, desfoque de 24px e raio de 28px; campos escuros com raio de 14px; botões em formato de pílula.
- Fonte: Plus Jakarta Sans via `next/font/google` (servida pelo próprio Next, sem requisição externa no navegador). Reutilize os logos oficiais; em fundo escuro, use as versões `_cl` (claras).
- [Contrato](docs/materials/contrato_dra_luciana.pdf): referência privada de escopo. Não importar como conhecimento do bot nem copiar dados contratuais pessoais/financeiros para a interface.
- [Planilha de mensagens](docs/materials/template_de_mensagens.xlsx): uma aba, com colunas **Mensagem** e **Resposta**, contendo conteúdo inicial, instruções de fluxo e informações da clínica misturados. Há respostas sem pergunta, placeholders e itens incompletos; não tratar todas as linhas como pares prontos para publicação.
- Não implementar importador: o usuário esclareceu que a planilha era apenas referência de exemplos. Há durações distintas de consulta, cancelamento com alternativas de 24h/48h e respostas diferentes sobre preço; esses pontos continuam sujeitos à validação clínica, sem resolver por suposição.
- A planilha menciona PDFs explicativos de procedimentos, mas esses anexos não estão presentes em `docs/materials/` neste mapeamento. Não presumir que estão disponíveis.
- Materiais internos ficam fora de `public/` e estão excluídos das imagens pelo `.dockerignore`. Não publicar documentos internos ou conteúdo clínico sem revisão.

## Desenvolvimento e verificações

Execute comandos na raiz. Se o `pnpm` do host divergir da versão fixada, use `corepack pnpm` quando Corepack estiver disponível, sem alterar outros projetos.

Preparação, apenas conforme necessário: `node scripts/setup-env.mjs` **somente se `.env` não existir**, `pnpm install --frozen-lockfile` e `pnpm run db:generate`. O utilitário de ambiente recusa sobrescrita; não remover um `.env` existente para fazê-lo funcionar. Scripts de instalação estão desabilitados por `ignoreScripts: true`; Prisma é gerado explicitamente.

| Comando | Uso e dependências |
|---|---|
| `pnpm run dev:frontend` / `pnpm run dev:backend` | Servidores locais, portas 3000/3001; API requer banco e ambiente |
| `pnpm run db:generate` | Gera o cliente Prisma; não é build da aplicação |
| `pnpm run typecheck` | Verifica os três workspaces sem compilar a aplicação |
| `pnpm test` | Testa geração de ambiente e saúde/configuração da API |
| `pnpm run test:infra` | Valida topologia Compose; exige CLI Docker Compose |
| `pnpm run test:workflows` | Valida os oito exports revisados, sete referências, remoção de dados privados e bloqueios; não executa workflows nem acessa serviços externos |
| `pnpm run db:validate` | Valida o schema Prisma |
| `pnpm run test:integration` | Exige Docker e `.env` local; cria banco temporário exclusivo, aplica migrations e o remove ao final |
| `pnpm run test:browser` | Ensaio isolado com contas e IA fictícias; exige Playwright/Chromium já disponíveis e portas 3100/3101 livres; nenhum build/instalação automática |
| `pnpm run test:calendar:browser` | Agenda com OAuth interceptado e provedor Google fictício, usando banco/contas e portas de ensaio exclusivos; nenhum evento real |
| `pnpm run test:design:browser` | Fluxos da interface de referência, responsividade, editor e navegação móvel com banco/contas fictícios; mesmo cache isolado e portas 3100/3101 dos outros runners |
| `pnpm run test:smtp` | Acrescenta Mailpit local e STARTTLS; exige Docker/OpenSSL, sem envio externo |
| `pnpm run db:migrate` | Aplica migrations existentes com `prisma migrate deploy`; altera o banco apontado |
| `pnpm --filter @dra/backend run db:migrate:dev --name nome_da_alteracao` | Cria migration em desenvolvimento; pode exigir banco sombra dedicado |

Para iniciar somente o banco local, sem build:

```powershell
docker compose --env-file .env -f compose.yaml -f compose.dev.yaml up -d --no-build --wait postgres
```

Para validar a configuração sem imprimir segredos:

```powershell
docker compose --env-file .env -f compose.yaml -f compose.dev.yaml config --quiet
```

Execute verificações pertinentes à alteração. Os testes de integração precisam ser acionados pelos runners da raiz para preparar banco e SMTP; os arquivos de teste podem pular cenários quando executados diretamente sem essas dependências. Não declarar aprovação com base somente nesses testes pulados.

**Builds somente mediante pedido explícito do usuário.** Não executar `next build`, scripts `build`, `docker build`, `docker compose build` ou opções que construam imagens implicitamente como parte de uma verificação rotineira. Uma autorização registrada para um ensaio anterior não autoriza novos builds. Não adicionar build automático a instalação, hooks ou pipelines. Usar `--no-build` ao iniciar serviços. Alterações de migrations exigem reconstrução explícita da imagem `migrate` antes de utilizá-la no Compose.

## Ambientes, dados e operação

- Desenvolvimento completo: projeto `dra-dev`, painel/API em `http://localhost:8090`, n8n em `http://localhost:5678` e banco em `localhost:5432`. Portas vinculadas a `127.0.0.1`.
- No host: painel em `http://localhost:3000`, API em `127.0.0.1:3001` e `APP_ORIGIN=http://localhost:3000`. `localhost` e `127.0.0.1` são origens diferentes para autenticação.
- Produção: `compose.yaml` + `compose.prod.yaml`, domínio do painel e subdomínio separado para n8n. Apenas Caddy publica portas; o banco fica na rede interna. O serviço `migrate` deve terminar com sucesso antes da API.
- PostgreSQL tem bancos/usuários separados: `dra_app`/`dra_app` para a aplicação e `n8n`/`dra_n8n` para automação. Não conceder `CREATEDB` à aplicação em produção nem reutilizar bancos de outros projetos.
- Ensaios usam `dra-validation` e `dra-restore`, com ambientes, contas, volumes e portas próprios: 18443/18567 e 20443/20567. O n8n desses ensaios fica sem saída externa. A restauração recusa volumes já existentes.
- Preserve volumes persistentes, contas existentes e serviços de outros trabalhos. Não usar `down -v`, limpeza global do Docker ou restauração sobre banco existente para reiniciar/testar o projeto. Antes de qualquer limpeza, identificar precisamente os recursos fictícios envolvidos.
- `.env`, `.env.*` privados, `backups/`, cookies, tokens e certificados de ensaio não devem ser versionados. Os arquivos `.env.example` e `.env.production.example` são modelos sem credenciais. Não imprimir segredos, corpos de requisição ou conteúdo clínico em logs/relatórios.
- O backup restic inclui os dois bancos, arquivos n8n, Caddy, fontes e ambiente com a chave n8n. Pausa brevemente os serviços para consistência e os retoma antes do upload. Retenção prevista: 7 diários, 4 semanais, 6 mensais; timer às 03h de São Paulo.
- O backup/restauração foi validado em armazenamento local de ensaio. Destino fora da máquina, execução systemd, alertas e HTTPS/SMTP públicos continuam pendentes. Não declarar prontidão de produção a partir do ensaio local.
- Antes de atualizar produção, seguir o roteiro de backup e migrations. Trocar uma senha no ambiente não altera um usuário PostgreSQL já criado; rollback de imagem não reverte migrations.

## Documentação de referência e manutenção

| Documento | Quando consultar |
|---|---|
| [README.md](README.md) | Entrada do projeto, requisitos e comandos locais |
| [docs/PLANO_DO_PROJETO.md](docs/PLANO_DO_PROJETO.md) | Objetivo, decisões, etapas, funcionalidades e critérios de aceite |
| [docs/ETAPA_2_CONTEUDO.md](docs/ETAPA_2_CONTEUDO.md) | Sequência da etapa 2, incremento de Respostas, API, migrations e verificações |
| [docs/CONHECIMENTO_ASSISTENTE.md](docs/CONHECIMENTO_ASSISTENTE.md) | Conhecimento, configuração única da assistente, acesso futuro à IA e verificações do segundo incremento |
| [docs/VERSOES_SIMULADOR_IA.md](docs/VERSOES_SIMULADOR_IA.md) | Estado atual da etapa 2, versões/ativação interna, simulador, sugestões, OpenAPI, configuração OpenAI e evidências |
| [docs/AGENDA_GOOGLE.md](docs/AGENDA_GOOGLE.md) | Prioridade antecipada da agenda, configuração Google Cloud/OAuth, permissões, horários, API, testes e pendências externas |
| [docs/INTEGRACAO_N8N.md](docs/INTEGRACAO_N8N.md) | Recebimento da base da equipe, sanitização/importação bloqueada, diagnóstico e sequência da integração real |
| [docs/INTERFACE_REFERENCIA.md](docs/INTERFACE_REFERENCIA.md) | Interface do protótipo HTML aplicada ao painel, navegação celular, etapas da Assistente e ensaios visuais isolados |
| [docs/AUTENTICACAO.md](docs/AUTENTICACAO.md) | Sessões, perfis, rotas, bootstrap, SMTP e integração |
| [docs/INFRAESTRUTURA.md](docs/INFRAESTRUTURA.md) | Topologia, VPS, atualizações, backup e restauração |
| [docs/RESULTADOS_VALIDACAO_ETAPA_1.md](docs/RESULTADOS_VALIDACAO_ETAPA_1.md) | Evidências e limites da validação local de 10/11/2026 |
| [docs/PENDENCIAS_DE_TESTE.md](docs/PENDENCIAS_DE_TESTE.md) | Testes ainda pendentes por etapa, atualizado em 12/11/2026 |
| [docs/PLANO_VALIDACAO_ETAPA_1.md](docs/PLANO_VALIDACAO_ETAPA_1.md) | Objetivos e critérios do ensaio local |
| [docs/ENSAIO_LOCAL_ETAPA_1.md](docs/ENSAIO_LOCAL_ETAPA_1.md) | Repetição do ensaio, ambientes fictícios e restauração isolada |
| [n8n/workflows/README.md](n8n/workflows/README.md) | Regras de exportação de workflows sem dados/credenciais |

Ao mudar arquitetura, comandos, escopo ou estado das funcionalidades, atualize este arquivo e os documentos afetados. Ao concluir testes, registre data, ambiente e evidências no acompanhamento correspondente; marque uma pendência como concluída somente depois de executá-la. Mantenha explícita a diferença entre implementação, validação local e aceite operacional.
