# Etapa 2 — versões, simulador e sugestões de IA

Implementação em 11/11/2026, ambiente local Windows/Docker. Complementa [ETAPA_2_CONTEUDO.md](ETAPA_2_CONTEUDO.md) e [CONHECIMENTO_ASSISTENTE.md](CONHECIMENTO_ASSISTENTE.md).

## Decisão de escopo

O usuário esclareceu que a planilha era um material inicial para exemplificar o atendimento desejado. **Importador de planilhas não é requisito do painel.** O conteúdo é mantido nas áreas Respostas, Base de conhecimento e Assistente. Fornecer essas orientações como contexto à IA não representa fine-tuning nem comprova treinamento de um modelo existente.

## Versões e ativação interna

Em `/configuracoes/versoes`, admin/editor consultam histórico, descrição, conteúdo e versão ativa. Somente admin cria/ativa ou restaura versões, com autorização também na API.

- O snapshot `schemaVersion: 1` inclui todas as respostas e informações, inclusive desativadas, e a configuração completa da assistente. Desativados não são fornecidos ao motor de respostas.
- Antes da ativação: assistente cadastrada, pelo menos um conteúdo ativo e todos os conteúdos ativos marcados como revisados. O limite do snapshot é de 1 milhão de caracteres serializados.
- A prévia retorna fingerprint SHA-256 canônico e ID da versão ativa. Ativação rejeita prévia obsoleta, mudança da versão ativa ou disputa concorrente com HTTP 409.
- Criação da versão e alteração do ponteiro ativo acontecem na mesma transação serializável. Trigger PostgreSQL rejeita UPDATE/DELETE dos registros de versão. Identificação do autor e data são preservadas no histórico.
- Restaurar cria outra versão imutável, com `restoredFrom`, e troca o ponteiro na mesma transação. **Não sobrescreve os rascunhos atuais.**
- A ação se chama **ativação interna**. Não há endpoint de publicação/envio ao WhatsApp nem mudança de workflow. O botão de publicação para WhatsApp permanece desabilitado.

## Simulador

Em `/simulador`, admin/editor escolhem rascunhos atuais ou uma versão salva e iniciam uma conversa. O conteúdo fica copiado e fixo durante todo o teste. Cada usuário acessa e exclui somente as próprias conversas, inclusive pela API.

Dois modos explícitos:

1. **Demonstrativa, sem IA:** busca textual e seleção de resposta cadastrada, considerando as últimas perguntas. Não é uma avaliação de inteligência ou equivalência com o bot.
2. **IA real, OpenAI:** usa a conexão configurada no backend. Sem configuração, retorna indisponibilidade e a opção fica desabilitada. Não há substituição silenciosa pelo modo demonstrativo.

Até 50 conversas por usuário e 20 perguntas por conversa. Perguntas têm até 2000 caracteres; respostas, até 6000. É possível reabrir e excluir testes. Os testes ficam na tabela própria `simulation`; não existem destinatário, número WhatsApp, ferramenta de envio ou chamada n8n.

O motor recupera até cinco conteúdos ativos por busca textual, usando até as últimas três perguntas para seleção. A IA recebe as últimas 12 mensagens, conteúdos selecionados e regras da assistente. O painel mostra os conteúdos **fornecidos como contexto**, sem afirmar que o modelo utilizou todos. Encaminhamento explícito usa a mensagem configurada. Sem informações suficientes, as instruções pedem encaminhamento humano, sem inventar políticas, preços ou disponibilidade.

`requestId` identifica cada tentativa de mensagem. Repetir uma tentativa concluída retorna a conversa, sem duplicação de resposta. Uma trava temporária impede processamento simultâneo. Falha de provedor preserva o histórico e libera a conversa; não há retentativa automática de chamada paga. Revisão obsoleta retorna 409. A verificação de acesso é refeita antes de persistir a resposta.

As conversas podem conter dados sensíveis: use somente dados fictícios nos testes e exclua testes desnecessários. Não são copiadas para logs. O compartilhamento do motor/subworkflow com o atendimento real e a equivalência com WhatsApp serão validados na etapa 3; ainda não há workflow real exportado neste repositório.

## Sugestões de variações

Na edição de uma resposta salva, **Sugerir variações com IA** retorna até três sugestões, sem alterar o banco. A revisão enviada deve corresponder à resposta atual. A geração exige salvar edições locais antes.

Cada sugestão pode ser editada e adicionada ao formulário. A pessoa ainda precisa clicar em **Salvar rascunho**; o conteúdo volta ao estado editorial de rascunho. Mantém-se o limite de dez variações por modelo. Saída inválida do provedor não altera o conteúdo existente.

## Configuração OpenAI

O adaptador usa HTTP nativo para a [Responses API oficial](https://developers.openai.com/api/reference/resources/responses/methods/create). Variações usam [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), com validação adicional no backend. Não foram adicionadas dependências.

Configure **somente no ambiente privado do backend**:

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=
```

Escolha um modelo disponível no projeto da clínica, compatível com Responses e Structured Outputs. Nenhum modelo foi imposto como padrão. Não envie chaves pelo chat, não use `NEXT_PUBLIC_*` e não coloque segredos no repositório. O Compose repassa essas duas variáveis exclusivamente ao backend; os exemplos versionados ficam vazios.

Após configurar no `.env` local, recrie apenas o backend sem build, com banco já migrado:

```powershell
docker compose --env-file .env -f compose.yaml -f compose.dev.yaml up -d --no-build --no-deps --wait backend
```

Em `/configuracoes/integracoes`, o estado mostra presença da configuração e nome do modelo, sem exibir chave. **Não verifica saldo, acesso ao modelo ou conexão externa.** Neste desenvolvimento, chave e modelo continuam ausentes; nenhuma chamada paga foi realizada.

O endpoint externo é fixo (`https://api.openai.com/v1/responses`), sem redirecionamento ou ferramentas, com timeout de 35 segundos, `store: false` e até 1800 tokens de saída. `store: false` não substitui as políticas de tratamento de dados do provedor. Quota persistida de dez solicitações reais por minuto/usuário, compartilhada entre simulador e sugestões. Erros externos não expõem headers, corpos, chaves ou mensagens internas.

## API e migration

Todas as novas rotas exigem sessão válida; mutações exigem origem exata e JSON. OpenAPI autenticada em `GET /api/v1/openapi.json`, com contratos, parâmetros, respostas e limites das rotas do painel. Autenticação continua documentada em [AUTENTICACAO.md](AUTENTICACAO.md).

| Rota | Função |
|---|---|
| `GET /api/v1/content/draft` | Prévia consistente, fingerprint e pendências editoriais |
| `GET /api/v1/content/versions?page=1` | Histórico paginado e ID ativo |
| `GET /api/v1/content/versions/:id` | Snapshot completo |
| `POST /api/v1/content/versions` | Criar e ativar internamente, somente admin |
| `POST /api/v1/content/versions/:id/restore` | Nova versão baseada na escolhida, somente admin |
| `GET /api/v1/ai/status` | Presença de configuração, sem chamada ao provedor |
| `GET/POST /api/v1/simulations` | Listar próprios testes/iniciar conversa |
| `GET/DELETE /api/v1/simulations/:id` | Reabrir/excluir conversa própria |
| `POST /api/v1/simulations/:id/messages` | Testar mensagem com revisão e requestId |
| `POST /api/v1/responses/:id/variations` | Sugestões editáveis, sem salvamento automático |

A quinta migration, `20261111000300_versions_simulation`, é aditiva: `content_version`, `content_release`, `simulation`, `ai_request_window`, chaves estrangeiras, índices e trigger de imutabilidade. Não altera contas ou conteúdo anterior. Foi aplicada no desenvolvimento pelo host; a imagem Docker do migrador continua precisando de build explícito para incorporar migrations novas. Nenhum build foi executado.

## Validação local

Resultados automatizados em 11/11/2026:

- `pnpm run typecheck`: três workspaces aprovados.
- `pnpm test`: um teste de ambiente e quatro de API/configuração aprovados.
- `pnpm run test:infra`: dois testes Compose aprovados.
- `pnpm run db:validate`: schema válido.
- `pnpm run test:integration`: **44 testes aprovados**, incluindo quatro agrupamentos; um cenário SMTP pulado por não acionar Mailpit nesta rodada. Treze cenários novos em `backend/tests/integration/content-stage2.test.ts`.
- Integração cobre sessões reais, perfis, origem/JSON, prévia obsoleta, concorrência, snapshots completos e imutáveis no banco, restauração sem sobrescrita, persistência ao reabrir a aplicação, isolamento por usuário, idempotência, falhas, limites, sugestões sem efeitos colaterais, contrato HTTP do adaptador e referências OpenAPI.
- Comparação `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: sem diferenças após mapear também as relações do schema.
- Comparação SHA-256 de todos os registros anteriores: administradora, conta, duas sessões, sete respostas, cinco informações e uma configuração preservadas. Os exemplos continuam em revisão e não foram ativados automaticamente.

O provedor usado pelos testes é uma fixture, sem chamadas OpenAI. A fixture do navegador recusa qualquer banco fora de `dra_auth_test_ui_*` local, `NODE_ENV` diferente de `test` ou porta diferente de 3101. Nunca é importada pelo servidor real.

Runner de navegador reproduzível: `pnpm run test:browser`. Exige Playwright/Chromium previamente disponíveis, Docker e `.env` local. Não instala dependências nem executa build. Para usar uma instalação externa existente no Windows:

```powershell
$env:PLAYWRIGHT_PACKAGE_JSON='C:/caminho/node_modules/playwright/package.json'
$env:PLAYWRIGHT_EXECUTABLE_PATH='C:/caminho/chrome.exe'
pnpm run test:browser
```

O runner cria e remove um banco temporário, usa contas fictícias e servidores em 3100/3101, e preserva o desenvolvimento. Capturas ficam em `backups/validation/stage2-final/`, ignoradas pelo Git. A imagem antiga do migrador não é utilizada.

Resultado de `pnpm run test:browser`: **14 verificações aprovadas**, sem erros JavaScript de página ou requisições externas capturadas no navegador. Criação de versão, descrição não salva, prévia obsoleta, restauração, distinção entre rascunho/versão, conversa persistida, encaminhamento, fluxo IA com fixture, sugestão editável/salvamento, bloqueio de conteúdo sem revisão e permissões da equipe exercitados. Navegação nas seis áreas de conteúdo/configuração em desktop e 320/390/768/1024px sem overflow horizontal. Capturas de versões e simulador em desktop/celular inspecionadas. Teclado conferido nos controles do simulador; a rodada identificou e corrigiu a associação explícita do rótulo das sugestões. Não é certificação completa de acessibilidade.

Tentativas iniciais do runner foram corrigidas para aguardar o carregamento antes de testar foco e para distinguir o alerta da aplicação do anunciador de rotas do Next.js. A execução final dos 14 cenários foi aprovada. Esses ajustes no runner não equivalem a aprovações de testes que não tenham terminado.

Conferência final no Docker de desenvolvimento: PostgreSQL, backend, frontend e n8n saudáveis; Caddy verificado por HTTP real. `/health`, `/api/v1/health`, `/api/v1/ready` e `/login` retornaram 200; páginas novas redirecionaram anônimos para login e APIs de IA/OpenAPI retornaram 401 sem sessão. Zero bancos `dra_auth_test_*` restantes. Comparação final dos registros anteriores novamente idêntica. Serviços deixados em execução em `http://localhost:8080`, sem remover volumes ou alterar a administradora.

## Pendências externas e de aceite

- Configurar credencial/modelo OpenAI e validar uma chamada real, saldo/limites e qualidade das respostas/variações com a doutora.
- Revisar os conteúdos clínicos, substituir exemplos e confirmar informações/políticas ainda indefinidas. Marcação editorial de revisado não substitui essa aprovação.
- Etapa 3: exportar/inspecionar workflow real, consulta autenticada pelo n8n, subworkflow compartilhado e conexão oficial WhatsApp/Meta, preservando número/aplicativo.
- Operação: VPS, DNS/HTTPS público, SMTP e backup externos, agendamento e alertas continuam pendentes.
- Validação de artefatos novos de produção/migrador requer pedido explícito de build; esta rodada valida desenvolvimento, sem declarar prontidão de produção.
