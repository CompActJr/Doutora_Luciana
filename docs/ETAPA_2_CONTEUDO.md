# Etapa 2 — painel de conteúdo

Início: 11/11/2026, horário de São Paulo. Escopo: [PLANO_DO_PROJETO.md](PLANO_DO_PROJETO.md).

Atualização no mesmo dia: Base de conhecimento e Configurações da assistente foram implementadas no segundo incremento. Relatório específico em [CONHECIMENTO_ASSISTENTE.md](CONHECIMENTO_ASSISTENTE.md). As evidências do primeiro incremento abaixo permanecem como registro daquela rodada.

## Sequência de implementação

Atualização: importador retirado do escopo por esclarecimento do usuário. Versões, ativação interna, restauração, simulador, sugestões de IA e OpenAPI implementados no incremento seguinte; estado atual em [VERSOES_SIMULADOR_IA.md](VERSOES_SIMULADOR_IA.md). As evidências do primeiro incremento continuam históricas.

1. **Respostas persistidas — primeiro incremento:** biblioteca com busca, categorias, filtros, criação, edição, duplicação, desativação/reativação, revisão editorial e prévia estática. Admin e editor trabalham nos rascunhos, com proteção contra sobrescrita concorrente.
2. **Conhecimento e assistente — implementado:** informações da clínica em revisão, apresentação, tom, limites e encaminhamento humano, com validação e permissões na API. Aprovação clínica e integração efetiva com IA/bot continuam pendentes.
3. **Material inicial:** planilha como referência dos exemplos desejados, sem importador. Lacunas e conflitos clínicos dependem de aprovação.
4. **Versões e ativação interna — implementado:** snapshot completo imutável, transação, histórico e restauração por admin. Nenhum envio ao WhatsApp.
5. **Simulador e sugestões — implementado:** conversas persistidas e privadas com cópia fixa dos rascunhos ou versão, modo demonstrativo explícito e adaptador OpenAI, sugestões editáveis sem salvamento automático. A chamada real depende da configuração externa; subworkflow compartilhado e integração WhatsApp permanecem na etapa 3.

Os incrementos são uma sequência de trabalho dentro do plano existente. VPS, DNS/HTTPS público, SMTP externo, backup externo, agendamento e alertas continuam pendentes e separados deste trabalho.

## Primeiro incremento implementado

`/respostas` deixa de ser uma tela provisória. A biblioteca permite:

- Criar e editar título, categoria, exemplos de perguntas, resposta-base, variações manuais e estado de revisão.
- Buscar por título, resposta-base ou categoria, sem distinguir maiúsculas/minúsculas; filtrar categoria, revisão e atividade; paginar em grupos de 20.
- Duplicar a versão salva como um modelo independente, ativo e em rascunho.
- Desativar e reativar sem excluir conteúdo.
- Conferir no editor uma prévia estática da primeira pergunta e da resposta-base, incluindo alterações ainda não salvas.
- Receber avisos de carregamento, erro, sucesso, alterações não salvas e conflito de revisão. No celular, alternar entre Modelos, Editar e Prévia.

As categorias são textos cadastrados nos próprios modelos, com sugestões dos valores existentes. Não há cadastro separado de categorias neste incremento. A interface mantém os estilos e tokens existentes; shadcn/ui continua previsto, sem nova dependência neste incremento.

Estados editoriais: `draft` (Rascunho), `needs_review` (Em revisão) e `reviewed` (Revisado). **Todos continuam conteúdo de trabalho no painel. Revisado não significa publicado.** Alterar conteúdo revisado no formulário volta a rascunho; a pessoa pode escolher explicitamente um novo estado ao salvar. Duplicações sempre começam em rascunho.

A prévia está identificada como **Demonstrativa**, não executa IA, não envia mensagens e não consulta agenda. **Publicar no WhatsApp** permanece desabilitado para todos os perfis, e não há rota de publicação. Nenhum conteúdo da planilha ou conta real é criado automaticamente.

### Dados e limites

Migration aditiva: `20261111000100_response_drafts`. Cria o enum `ResponseReviewStatus`, a tabela `response_template` e índices de atividade/data e categoria. Não altera tabelas de autenticação.

| Campo | Regra |
|---|---|
| `title` | Texto de 3 a 120 caracteres |
| `category` | Texto de 1 a 80 caracteres |
| `questionExamples` | Até 20 perguntas de 1 a 500 caracteres; lista vazia permitida |
| `answer` | Texto de 1 a 6000 caracteres |
| `variations` | Até 10 textos de 1 a 6000 caracteres; lista vazia permitida |
| `reviewStatus` | `draft`, `needs_review` ou `reviewed` |
| `isActive` | Ativo por padrão; alterações por PATCH |
| `revision` | Inteiro iniciado em 1 e incrementado a cada alteração |

Textos têm espaços externos removidos. IDs e datas são gerados pelo servidor. Campos desconhecidos são rejeitados. Perguntas são separadas por linha no formulário; variações, por linha em branco.

### API

Todos os endpoints exigem sessão ativa e usuário não bloqueado. Admin e editor têm acesso. As rotas estão no mesmo escopo de proteção da autenticação: `Cache-Control: no-store`, origem exata e JSON para mutações, erros sem exposição de dados internos. O token reservado ao n8n não dá acesso a esses rascunhos.

| Método e rota | Comportamento |
|---|---|
| `GET /api/v1/responses` | Lista resumos e categorias; query `search`, `category`, `state=active\|inactive\|all`, `reviewStatus` e `page` |
| `GET /api/v1/responses/:id` | Obtém o modelo completo |
| `POST /api/v1/responses` | Cria modelo; corpo com os seis campos de conteúdo |
| `PATCH /api/v1/responses/:id` | Altera campos de conteúdo e/ou `isActive`; exige `revision` e pelo menos uma alteração |
| `POST /api/v1/responses/:id/duplicate` | Duplica a versão salva; corpo `{ "revision": 1 }`, usando a revisão atual |

Listagem retorna `items`, `total`, `page`, `pageSize` e `categories`. Detalhe e mutações retornam `{ "response": ... }`. Contratos em `packages/contracts/src/index.ts`.

Uma atualização verifica ID e revisão na mesma operação atômica no banco; revisão antiga retorna **409**, sem sobrescrever a edição mais recente. O formulário preserva o texto local e oferece reabrir a versão atual. A API volta o estado a rascunho quando conteúdo é enviado sem escolha explícita de revisão. Dados inválidos retornam 400, registro ausente 404 e falta de sessão 401.

Ainda não há endpoint OpenAPI, importador, IA, publicação, histórico de conteúdo ou integração real. As tabelas atuais não substituem os snapshots de configuração completa previstos no incremento de versões.

## Desenvolvimento sem build

Gerar o cliente com `pnpm run db:generate` e aplicar migrations com `pnpm run db:migrate` no ambiente local correto. Não executar reset do banco, bootstrap de administradora ou recriação de volumes.

O migrador Docker possui uma imagem própria: antes de usá-lo com esta nova migration, sua imagem precisará ser reconstruída **somente quando o usuário solicitar um build**. Até lá, a geração e a aplicação pelo host usam as fontes atuais, sem construir imagens.

Para executar frontend e API no host, seguir [AUTENTICACAO.md](AUTENTICACAO.md), com `APP_ORIGIN=http://localhost:3000`, PostgreSQL do projeto e os comandos `pnpm run dev:backend` e `pnpm run dev:frontend`. O ensaio de navegador usa outras portas e banco temporário, sem alterar o `.env` privado.

## Verificações desta entrega

Data: 11/11/2026. Node.js do host: 24.18.0; pnpm: 12.18.0; Docker Desktop com PostgreSQL 17.11. Nenhum build de aplicação ou imagem foi executado.

| Verificação executada | Resultado |
|---|---|
| `pnpm run db:generate` | Cliente Prisma gerado |
| `pnpm run typecheck` | Três workspaces aprovados, incluindo os novos contratos, rotas, tela e testes |
| `pnpm run db:validate` | Schema aprovado |
| `pnpm test` | 1 teste de ambiente e 4 de API/configuração aprovados |
| `pnpm run test:infra` | 2 testes de topologia Compose aprovados |
| `pnpm run test:integration` | 21 testes aprovados, incluindo os 2 agrupamentos; 1 cenário SMTP pulado por não acionar o capturador nesta execução; nenhuma falha |
| Nova suíte de respostas | 7 cenários com PostgreSQL e Better Auth reais: proteção HTTP, criação/persistência, busca/filtros/paginação, validação, concorrência, duplicação/atividade e bloqueio/ausência de publicação |
| Navegador | 12 verificações aprovadas com Chromium/Playwright, sem erros JavaScript de página |
| Tipagem final do frontend | `pnpm --filter @dra/frontend run typecheck` aprovado após os ajustes de navegação e acessibilidade |

O runner criou um banco `dra_auth_test_*` exclusivo, aplicou as três migrations e removeu esse banco ao final. Usuários e conteúdo fictícios ficaram nesse banco. A suíte de autenticação existente continuou passando. O envio SMTP não foi revalidado nesta rodada; suas evidências anteriores permanecem no relatório da etapa 1.

### Navegador e revisão visual

Ensaio automatizado com Chromium headless e Playwright disponíveis no computador, sem acrescentar dependências ao repositório. Frontend em `next dev` na porta 3100 e API de teste na porta 3101, com um segundo banco temporário exclusivo, migrations atuais e contas admin/editor fictícias. Nenhum build foi executado.

Foram aprovados no navegador: login e carregamento; biblioteca desktop e prévia demonstrativa; criação persistida no banco; aviso ao descartar edição, navegar por link ou sair (cancelar a saída mantém a sessão); conflito preservando o formulário e reabertura da revisão atual; duplicação, filtros de atividade, desativação/reativação; busca sem resultados; persistência após recarregar; abas móveis; edição pela equipe sem acesso à administração. Também foram conferidas ausência de overflow horizontal em 320, 390, 768 e 1024px e navegação por teclado entre título e categoria. Publicação permaneceu desabilitada. Nenhum erro JavaScript de página foi capturado.

A inspeção de tela foi feita em desktop de 1536px e celular de 390px. Capturas apenas com dados fictícios ficaram em `backups/validation/stage2/`, ignoradas pelo Git. O ensaio identificou nomes acessíveis que incluíam textos de ajuda; os campos receberam rótulos explícitos antes da rodada aprovada. Isso não representa auditoria completa de acessibilidade.

Para repetir a conferência funcional com uma conta de teste, entrar no painel, criar um modelo, salvar/recarregar, buscar/filtrar, duplicar, desativar/reativar, editar em duas sessões para provocar conflito e repetir no celular. O auxiliar desta rodada foi temporário, fora do repositório, utilizando o Playwright já instalado no cache local; não há uma suíte de navegador adicionada ao `pnpm test` neste incremento. O teste de API reproduzível permanece em `backend/tests/integration/responses.test.ts`, acionado por `pnpm run test:integration`.

### Aplicação local e preservação

- `pnpm run db:migrate` aplicou somente `20261111000100_response_drafts` ao banco de desenvolvimento. Nenhum reset, seed ou bootstrap foi executado nesse banco.
- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`, pelo workspace backend, confirmou ausência de diferença entre banco e schema.
- Uma comparação SHA-256 dos registros completos de usuários, contas e sessões antes/depois confirmou igualdade, incluindo hashes de senha: 1 usuária, 1 conta, 0 sessões em ambas as leituras. Valores privados não foram impressos nem versionados.
- O banco de desenvolvimento ficou com as três migrations e **zero modelos de resposta**: as demonstrações não foram importadas para o ambiente real.
- Os bancos temporários dos testes foram removidos. A inspeção posterior confirmou zero bancos `dra_auth_test_*` remanescentes. Os servidores temporários foram encerrados; volumes persistentes foram preservados.
- Os serviços de desenvolvimento estavam parados no início. Somente PostgreSQL foi iniciado para as verificações e voltou a ficar parado ao final, preservando seu volume. Nenhum serviço de outro projeto foi alterado.

Continuam pendentes: teste do incremento após reinício/recriação dos contêineres com migrador atualizado, auditoria mais ampla de acessibilidade, demais módulos da etapa 2 e todas as validações externas de produção. As pendências gerais permanecem em [PENDENCIAS_DE_TESTE.md](PENDENCIAS_DE_TESTE.md).
