# Etapa 2 — Base de conhecimento e Assistente

Data: 11/11/2026. Segundo incremento da sequência em [ETAPA_2_CONTEUDO.md](ETAPA_2_CONTEUDO.md). O aceite integral da etapa 2 e as pendências externas da etapa 1 continuam abertos.

Atualização posterior: versões, simulador e adaptador OpenAI implementados em [VERSOES_SIMULADOR_IA.md](VERSOES_SIMULADOR_IA.md). As referências a funcionalidades futuras abaixo descrevem o estado deste segundo incremento. Importador da planilha foi retirado do escopo por esclarecimento do usuário; a planilha era referência inicial, e não requisito de importação.

## Funcionalidades

### Base de conhecimento — `/conhecimento`

Admin e editor podem criar, consultar, buscar, categorizar, revisar, editar, desativar e reativar informações da clínica. A listagem tem filtros por categoria, atividade e revisão, com paginação de 20 itens. Busca por título, categoria e conteúdo sem distinguir maiúsculas/minúsculas. Categorias são textos dos próprios registros, com sugestões de valores existentes.

Campos: título (3–120 caracteres), categoria (1–80), conteúdo (1–12000) e revisão (`draft`, `needs_review`, `reviewed`). Listagem não inclui o corpo completo; o detalhe exige a mesma sessão autenticada. Desativar mantém o texto. Alterações de conteúdo voltam a rascunho, salvo uma escolha explícita de revisão ao salvar.

No celular, a lista abre o editor e há um botão para retornar, conforme a atualização visual de 12/11/2026 em [INTERFACE_REFERENCIA.md](INTERFACE_REFERENCIA.md). A interface indica carregamento, vazio, erro, sucesso e edição não salva; pede confirmação antes de descartar o formulário, navegar por link ou sair. Em conflito, mantém o texto local e oferece reabrir a versão atual.

### Assistente — `/assistente`

Configuração única de trabalho para a clínica, editável por admin/editor:

Desde 12/11/2026, o formulário apresenta cinco etapas: identidade, tom de voz, limites, encaminhamento à equipe e agendamento. O progresso indica campos preenchidos; alternar etapas não salva nem publica. Campos obrigatórios continuam validados em conjunto ao salvar.

| Campo | Limite |
|---|---|
| Nome da assistente | 1–80 caracteres |
| Apresentação | 1–2000 |
| Tom de voz | 1–2000 |
| Limites e cuidados | 1–4000 |
| Situações de encaminhamento humano | 1–20 itens, cada um com 1–300 caracteres |
| Mensagem de encaminhamento | 1–3000 |
| Orientações de agendamento | 1–2000 |

Os campos são obrigatórios, com espaços externos removidos. Situações são separadas por linha no formulário. O primeiro acesso não cria configuração nem preenche políticas automaticamente: `GET` retorna `settings: null` até alguém salvar. A interface apresenta uma prévia estática da apresentação e da mensagem de encaminhamento; sem IA, envio ou consulta de agenda.

Salvar continua sendo uma edição de rascunho. Não publica, ativa ou altera o bot. Publicação para WhatsApp permanece desabilitada. As orientações cadastradas precisarão ser integradas e avaliadas nas etapas futuras; sua persistência não comprova que um modelo de IA as cumpre.

## Dados, concorrência e acesso

Migration aditiva `20261111000200_knowledge_assistant`: acrescenta `knowledge_entry` e `assistant_settings`, sem alterar autenticação ou respostas existentes. Conhecimento reutiliza o enum editorial `ResponseReviewStatus`. A configuração usa ID fixo `clinic`, com restrição no banco para impedir outras instâncias.

Mutações usam `revision` para impedir sobrescrita. Conhecimento começa em 1; a criação da assistente exige revisão 0 e gera revisão 1. Duas criações concorrentes da assistente resultam em uma configuração e um conflito HTTP 409. Atualizações conferem revisão e incrementam o valor atomicamente. A escolha entre admin/editor não muda as permissões de publicação futuras: publicar e restaurar continuará sendo responsabilidade exclusiva da administradora.

Os módulos são registrados dentro do escopo protegido da API existente, preservando sessão, consulta de bloqueio/perfil no banco, origem exata, JSON em mutações, `Cache-Control: no-store` e mensagens de erro sem SQL ou credenciais. Campos desconhecidos são rejeitados. O token de serviço reservado ao n8n não dá acesso aos rascunhos.

| Método e rota | Retorno e comportamento |
|---|---|
| `GET /api/v1/knowledge` | `items`, `total`, `page`, `pageSize`, `categories`; queries `search`, `category`, `state`, `reviewStatus`, `page` |
| `GET /api/v1/knowledge/:id` | `{ entry }` ou 404 |
| `POST /api/v1/knowledge` | Cria com os quatro campos; retorna 201 e `{ entry }` |
| `PATCH /api/v1/knowledge/:id` | Campos parciais e/ou `isActive`, mais revisão atual; retorna `{ entry }` |
| `GET /api/v1/assistant-settings` | `{ settings }`; valor nulo enquanto não houver cadastro |
| `PUT /api/v1/assistant-settings` | Todos os sete campos mais revisão; cria com 0 ou atualiza com a revisão atual |

Contratos públicos em `packages/contracts/src/index.ts`. Nenhum endpoint de publicação ou chamada de IA foi criado neste incremento.

## IA OpenAI e contas ChatGPT

A autorização do usuário para utilizar OpenAI foi registrada, mas a assinatura não fica automaticamente disponível ao painel. Na inspeção desta rodada, `OPENAI_API_KEY`, `OPENAI_MODEL` e `OPENAI_PROJECT_ID` não estavam configurados no ambiente examinado. Apenas a presença foi verificada; nenhum segredo foi exibido. Nenhuma requisição de inferência ou consumo pago foi executado.

Documentação oficial consultada em 11/11/2026:

- [Credenciais de aplicações e contas de serviço](https://developers.openai.com/api/docs/guides/api-keys): aplicações automatizadas podem ter identidade e chave próprias, mantidas no servidor.
- [Sign in with ChatGPT](https://developers.openai.com/siwc/quickstart): uso do plano em aplicações exige integração própria, elegibilidade e autorização; acesso não é concedido apenas por a pessoa já usar ChatGPT/Codex.
- [Créditos de API para assinantes elegíveis](https://developers.openai.com/api/docs/guides/chatgpt-api-credits): alguns planos podem ter benefícios a serem vinculados à organização de API. A elegibilidade e o saldo destas contas não foram verificados.

OpenAI Developers foi localizado como integração disponível, mas sem instalação/conexão confirmada nesta rodada. Isso não bloqueia Base de conhecimento ou Assistente. Quando houver acesso configurado, validar a integração real e suas limitações com conteúdo fictício antes de qualquer atendimento a pacientes. Não utilizar credenciais locais do editor como credenciais implícitas do bot, nem inserir chaves na interface ou no repositório.

## Verificações executadas

Ambiente local: Windows, Node.js 24.18.0, pnpm 12.18.0 e PostgreSQL 17.11 do projeto. Sem builds de aplicação/imagem e sem modificações em `.env` privados.

| Verificação | Evidência |
|---|---|
| Geração Prisma | Cliente atualizado com os dois novos modelos |
| Tipagem | Três workspaces aprovados |
| `pnpm run test:integration` | 30 testes aprovados, incluindo 3 agrupamentos; 1 cenário SMTP pulado por não iniciar o capturador nesta rodada; nenhuma falha |
| Nova suíte de conhecimento/assistente | 8 cenários com sessões e PostgreSQL reais: acesso/origem/JSON, busca/paginação, limites, concorrência, atividade, criação única sem efeitos em GET, persistência e bloqueio |
| Regressões | Suítes de autenticação e Respostas existentes aprovadas |
| `pnpm test` | 1 teste de ambiente e 4 de API/configuração aprovados |
| `pnpm run db:validate` | Schema válido |
| Migration no desenvolvimento | Aplicada pelo host, sem executar a imagem antiga do migrador |
| Comparação banco/schema | `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: sem diferenças |
| Navegador | 12 verificações aprovadas com Chromium/Playwright local, incluindo uso pela equipe, conflitos, persistência e responsividade |

Os testes usam banco temporário `dra_auth_test_*` e contas fictícias. SMTP, HTTPS público, backup externo e demais testes operacionais não foram reexecutados por este incremento.

### Navegador e preservação

- Ensaio isolado com frontend `next dev` em 3100, API em 3101, banco temporário próprio e contas admin/editor fictícias. O auxiliar ficou fora do repositório e utilizou Playwright/Chromium já disponíveis no computador, sem acrescentar dependências ao projeto.
- Foram exercitados cadastro e recarga de conhecimento, busca/vazio, revisão invalidada na edição, desativação/reativação, abas móveis, cancelamento da navegação/logout com formulário alterado e conflito preservando o texto local. Na assistente: consulta inicial sem criação, formulário completo, recarga, conflito/reabertura, edição pela equipe e navegação inicial por teclado.
- Responsividade da assistente conferida em 320, 390, 768 e 1024px, sem overflow horizontal; capturas da base e assistente em desktop/celular foram inspecionadas. Isso não representa auditoria completa de acessibilidade.
- A prévia e a publicação desabilitada foram verificadas. Nenhum erro JavaScript de página ou requisição externa do navegador foi capturado.
- Capturas somente com dados fictícios ficaram em `backups/validation/knowledge-assistant/`, ignoradas pelo Git. A suíte de API reproduzível está em `backend/tests/integration/knowledge-assistant.test.ts`; o ensaio de navegador foi um auxiliar temporário, não um novo comando de teste do projeto.
- Usuários e contas existentes foram comparados antes/depois por SHA-256 dos registros completos: uma usuária e uma conta, com hashes de senha e demais campos inalterados. Sessões em uso não foram apagadas nem invalidadas.
- Ao final dos testes, o desenvolvimento tinha zero entradas de conhecimento, zero configurações de assistente e zero respostas; nenhum conteúdo fictício foi cadastrado nesse banco. Todos os bancos temporários foram removidos.

Os serviços Docker de desenvolvimento estavam em execução e foram preservados. Backend e frontend foram reiniciados sem build para carregar cliente Prisma e rotas atuais; banco, volumes e n8n não foram recriados. As novas páginas exigem login. Publicação, integração real de IA, demais incrementos da etapa 2 e validações externas continuam pendentes.

Para repetir os testes automatizados da API: `pnpm run db:generate`, `pnpm run typecheck` e `pnpm run test:integration`, conforme os requisitos de ambiente do README. O migrador Docker continua exigindo reconstrução explícita para incorporar as migrations novas; esta rodada usa aplicação pelo host e não executa build.

## Exemplos preenchidos a pedido do usuário — 11/11/2026

Após a validação do segundo incremento, o usuário solicitou exemplos no painel de desenvolvimento. Foram cadastrados explicitamente:

- **7 respostas:** boas-vindas, interesse na primeira consulta, valores a confirmar, solicitação de agendamento, cancelamento/reagendamento, atendimento humano e encaminhamento de dúvida clínica individual.
- **5 informações de conhecimento:** papel da assistente, dados da clínica ainda a confirmar, agendamento sem agenda integrada, encaminhamento humano e cuidados com conteúdo/dados de pacientes.
- **1 configuração da assistente:** nome e textos identificados como exemplo, tom acolhedor, limites, situações de encaminhamento e orientações de agendamento.

Respostas e conhecimento usam títulos `[EXEMPLO]`, categorias de exemplos e estado `needs_review`. Os textos da assistente indicam revisão necessária. Não foram definidos valores, horários disponíveis, prazos de cancelamento ou políticas clínicas como se estivessem aprovados. Nenhum conteúdo foi publicado ou enviado a pacientes.

O comando manual é `pnpm run demo:seed`. A implementação fica em `backend/src/demo/seed.ts`, com IDs fixos para exemplos e inserção sem sobrescrita dentro de transação. Preserva inclusive exemplos editados depois da primeira execução e qualquer configuração da assistente já existente. Aceita somente o banco local `dra_app` e rejeita `NODE_ENV=production`. Não é um seed automático. Importador não faz parte do escopo atual.

Verificações executadas nesta rodada:

- Primeira execução: 7 respostas, 5 informações e 1 configuração criadas; o banco estava sem conteúdo antes do preenchimento.
- Segunda execução: zero registros criados. Comparação SHA-256 de todos os conteúdos confirmou igualdade, incluindo revisões e datas; não houve duplicação nem atualização silenciosa.
- Usuários, contas e conteúdos anteriores conferidos por comparação SHA-256: preservados, sem redefinição de senha ou alteração da administradora.
- Rejeição de execução em produção e mensagem segura para URL inválida conferidas. Nenhuma conexão de produção foi utilizada.
- `pnpm --filter @dra/backend run typecheck`: aprovado.

O painel Docker continua disponível em `http://localhost:8080`; recarregar as páginas exibe os exemplos. Não houve build, nova migration, alteração de volumes, chamada de IA ou execução de workflows. As evidências anteriores de banco vazio descrevem o estado antes desta solicitação, e não o estado após o preenchimento.
