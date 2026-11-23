# Agenda de consultas — integração Google Agenda

Data: 11/11/2026. Por solicitação do usuário, esta entrega foi **antecipada à etapa 3 de WhatsApp/n8n**, que permanece adiada e pendente. Não depende de OpenAI ou n8n para funcionar.

## O que foi implementado

- Área `/agenda`, com acesso exclusivo de `admin`, também validado em cada rota da API. A equipe `editor` não recebe automaticamente acesso aos dados de consultas.
- Conexão pelo botão **Conectar Google Agenda**, autorização da conta Google e seleção de uma agenda com permissão de edição. Não é necessário tornar a agenda pública.
- Visualização por dia, semana ou mês, navegação de datas, horário de início/término, recorrência e eventos de dia inteiro. Desde 12/11/2026, dia/semana usam grade horária no desktop e seleção de dia com compromissos em lista no celular; referência em [INTERFACE_REFERENCIA.md](INTERFACE_REFERENCIA.md). Atualização manual; sem sincronização por push ou polling automático.
- Criação de consultas com título, observações administrativas, início e término. Não há duração clínica padrão: horários são preenchidos pela administradora.
- Edição/reagendamento e cancelamento confirmado de eventos comuns com horário e sem convidados. Recorrências expandidas permitem alterar **somente a ocorrência escolhida**, sem editar a série inteira.
- Eventos especiais, bloqueados, de dia inteiro, com convidados ou com textos acima dos limites de edição são exibidos como somente leitura; devem ser gerenciados no Google Agenda. Nenhum convite ou participante é cadastrado pelo painel.
- Indicação de carregamento, erros, ausência de conexão, necessidade de reconexão, vazio, alteração não salva e conflito. Uma falha não é apresentada como consulta salva.

O Google é a fonte dos compromissos. Não há cópia local de consultas ou informações clínicas no PostgreSQL: os eventos são consultados diretamente pela API. Conta, agenda escolhida, fuso e credencial cifrada ficam persistidos para a conexão sobreviver a reinícios.

O simulador e a IA **não têm acesso à agenda** neste incremento. Não há agendamento automático, envio de WhatsApp, lembretes implementados pelo painel ou alteração do workflow n8n. Regras e notificações próprias da agenda/conta Google continuam sujeitas à configuração do Google.

## Conectar pela primeira vez

Ajuste de interface em 12/11/2026: tutorial técnico, link do console e URI OAuth removidos do painel a pedido do usuário. Verificação executada: `pnpm --filter @dra/frontend run typecheck`, aprovada; busca no código confirmou ausência desses elementos na interface. Nenhum build ou teste com conta Google real foi executado por essa alteração.

Há uma configuração técnica inicial do aplicativo, de responsabilidade da equipe de desenvolvimento. Este roteiro é documentação interna e não aparece na interface da doutora. Depois dessa preparação, ela usa o botão de conexão e escolhe sua conta/agenda.

1. No projeto Google Cloud da clínica, habilitar a **Google Calendar API**.
2. Configurar a tela de consentimento OAuth. Em modo de teste, cadastrar a conta da doutora como usuária de teste. Disponibilidade, verificação do aplicativo e expiração de autorizações em modo de teste devem ser conferidas no Google antes do uso real.
3. Criar um cliente OAuth do tipo **Aplicativo da Web**. Não usar apenas uma chave de API ou credencial do n8n.
4. Cadastrar exatamente a URI de retorno correspondente ao `APP_ORIGIN` do ambiente, conforme a tabela abaixo. O endereço e as instruções do Google Cloud ficam nesta documentação interna:

| Ambiente | URI |
|---|---|
| Docker de desenvolvimento | `http://localhost:8090/api/v1/calendar/oauth/callback` |
| Frontend/API no host | `http://localhost:3000/api/v1/calendar/oauth/callback` |
| Produção | `https://DOMINIO_DO_PAINEL/api/v1/calendar/oauth/callback` |

5. Configurar somente no ambiente privado do backend:

```dotenv
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_TOKEN_KEY=
```

`GOOGLE_CALENDAR_TOKEN_KEY` é uma chave exclusiva AES-256: **64 caracteres hexadecimais aleatórios**, gerados com ferramenta criptográfica. Não reutilizar segredo de sessão, chave n8n ou senha do banco. Guardar a chave com o ambiente privado/backups criptografados; perder/trocar essa chave impede ler credenciais anteriores. Não enviar segredos pelo chat nem versioná-los.

6. Com banco já migrado, carregar as variáveis no backend sem build:

```powershell
docker compose --env-file .env -f compose.yaml -f compose.dev.yaml up -d --no-build --no-deps --wait backend
```

7. Entrar como administradora em `/agenda`, clicar **Conectar Google Agenda**, autorizar as permissões solicitadas e clicar **Escolher agenda**. Preferir uma agenda da clínica, conferindo seu nome e fuso. Apenas agendas editáveis são oferecidas.
8. Validar primeiro em uma agenda de teste, com compromissos fictícios. Só depois selecionar a agenda de consultas real e obter o aceite da doutora.

Sem as três configurações, o botão fica desabilitado e a aplicação mostra apenas “A conexão com o Google Agenda ainda não está disponível.” Não há tutorial, link do Google Cloud ou URI de retorno na interface. Não cria dados demonstrativos nem exibe horários fictícios como reais. O estado de configuração não comprova que as credenciais do Google são válidas.

## Autorização e proteção das credenciais

O fluxo segue a [autorização OAuth para aplicações Web do Google](https://developers.google.com/identity/protocols/oauth2/web-server). O backend solicita acesso offline e consentimento explícito para obter refresh token. Escopos: `openid`, `email`, `calendar.calendarlist.readonly` e `calendar.events`, com os dois últimos sob `https://www.googleapis.com/auth/`.

- `state` aleatório, armazenado apenas como SHA-256, vinculado à administradora e com validade de dez minutos/uso único. Uma nova tentativa da mesma administradora substitui a anterior. O callback exige sessão e perfil válidos.
- PKCE S256; o verificador fica cifrado no banco. O callback não confia em Host/headers do cliente para construir URLs.
- Refresh token cifrado com AES-256-GCM, IV aleatório e autenticação do conteúdo. Access token é obtido para a operação e não é enviado ao navegador nem persistido.
- Respostas públicas não incluem tokens, segredos ou verificador OAuth. Logs de requisições permanecem desativados; erros brutos do Google não são repassados.
- Falha/rejeição do OAuth preserva uma conexão existente. Revogação ou `invalid_grant` solicita reconexão. Reautorizar reinicia a seleção da agenda.
- Desconectar apaga a credencial local e tenta revogar o acesso no Google, **sem apagar eventos**. Se a revogação externa não for confirmada, a interface avisa para revisar as permissões da conta Google.

Use dados administrativos mínimos no título/observações e evite diagnósticos ou detalhes clínicos. Credenciais e ambiente precisam permanecer protegidos também nos backups.

## Horários, conflitos e retentativas

A API usa o fuso IANA da agenda selecionada, sem supor deslocamento UTC fixo. Horários inexistentes ou ambíguos em transições de fuso são rejeitados. O fim precisa ser posterior ao início, com limite técnico de 12 horas por consulta; isso não define duração clínica aprovada. Consultas de listagem aceitam períodos de até 42 dias, com limite superior exclusivo.

Antes de salvar/reagendar, o painel consulta eventos sobrepostos, incluindo bloqueios de dia inteiro; eventos transparentes não bloqueiam. Operações do próprio painel são serializadas por trava transacional. **Isso não oferece exclusão atômica contra outros aplicativos**: um evento pode ser criado diretamente no Google entre a verificação e a gravação. Atualize a visualização e valide esse comportamento no uso real.

Edição/cancelamento enviam o `etag` atual com [`If-Match`](https://developers.google.com/workspace/calendar/api/guides/version-resources), impedindo sobrescrita do mesmo evento alterado externamente. Um conflito mantém o formulário; reabra a versão atual antes de salvar.

Criação usa `requestId` e ID determinístico aceito pelo Google, com hash do corpo em propriedade privada. Uma retentativa após timeout recupera a criação anterior em vez de duplicá-la. Reutilizar a tentativa com conteúdo diferente é rejeitado. A API nunca repete automaticamente uma gravação que possa já ter sido realizada.

Revisão e geração da conexão acompanham as operações e o editor, evitando que um formulário antigo seja aplicado silenciosamente a outra conta/agenda após reconexão. A [listagem de eventos](https://developers.google.com/workspace/calendar/api/v3/reference/events/list) trata paginação e expande recorrências; não toma uma página incompleta como ausência de conflito.

## Banco e operação

Sexta migration aditiva: `20261111000400_google_calendar`, com `calendar_connection` e `calendar_oauth_state`. Não altera contas, senhas, sessões, rascunhos, versões ou conversas existentes.

```powershell
pnpm run db:generate
pnpm run db:migrate
```

Desenvolvimento usa aplicação das migrations pelo host. A imagem antiga do serviço `migrate` **não deve ser utilizada** até um build explícito que inclua as migrations novas. Nenhum build é executado pelo fluxo de conexão ou pelos testes.

O Compose passa as três variáveis somente ao backend; frontend e n8n não recebem credenciais. `.env.example` e `.env.production.example` têm valores vazios. A API pode permanecer ativa com Google não configurado.

## API

Todas as rotas exigem administradora ativa. Mutações, exceto o callback OAuth GET controlado por state, exigem origem exata e JSON. Contratos públicos em `packages/contracts/`; OpenAPI autenticada atualizada em `/api/v1/openapi.json`.

| Método e rota sob `/api/v1/calendar` | Função |
|---|---|
| `GET /status` | Configuração, conta, seleção, fuso e necessidade de reconectar, sem tokens |
| `POST /connect` | URL de autorização Google com state e PKCE |
| `GET /oauth/callback` | Consome autorização e redireciona ao painel |
| `GET /calendars` | Agendas editáveis da conta |
| `PUT /selection` | Selecionar agenda/fuso com revisão e geração da conexão |
| `POST /disconnect` | Desconectar localmente e tentar revogação |
| `GET /events` | Eventos no período `from`/`to`, com revisão/geração |
| `POST /events` | Criar consulta com `requestId` |
| `PATCH /events/:id` | Editar/reagendar com `etag` |
| `DELETE /events/:id` | Cancelar com `etag` e confirmação explícita |

## Validação e pendências

Os testes automatizados usam PostgreSQL temporário, contas fictícias e provedor Google injetado. Não representam autorização ou operação de uma conta real da doutora.

- `pnpm run typecheck`: três workspaces aprovados.
- `pnpm test`: um teste de ambiente e quatro de API/configuração aprovados.
- `pnpm run test:infra`: dois testes de Compose aprovados.
- `pnpm run db:validate`: schema válido.
- `pnpm run test:integration`: 61 aprovados, incluindo cinco agrupamentos; um cenário SMTP pulado nesta rodada. Dezesseis cenários novos em `backend/tests/integration/calendar.test.ts`.
- Casos novos: admin/editor/anônimo, origem/JSON, ausência de configuração, state/PKCE/expiração/replay/vínculo, cifra/decifra e chave errada, seleção/revisões/gerações, fuso/DST, idempotência após timeout, concorrência e sobreposição, listagem/dia inteiro, etags, convidados somente leitura, cancelamento, reconexão, revogação, falha OAuth, bloqueio de acesso e contrato HTTP Google/paginação/limites.

Runner de navegador: `pnpm run test:calendar:browser`, com os mesmos requisitos de Playwright/Chromium do [ensaio da etapa 2](VERSOES_SIMULADOR_IA.md). Usa portas 3100/3101 e banco `dra_auth_test_ui_*` exclusivos. A autorização é interceptada pelo navegador e as operações ficam em provedor fictício. O código de fixture não é importado pelo servidor real. Capturas ficam em `backups/validation/calendar/`, ignoradas pelo Git.

Resultado final: **13 verificações de navegador aprovadas**. Incluem OAuth interceptado/seleção, horários, criar/reagendar/cancelar, conflitos preservando formulário, concorrência em duas abas, recorrências e eventos de dia inteiro, teclado, conexão após recarga, desconexão e bloqueio da equipe. Dia/semana/mês em 320/390/768/1024/1536px sem overflow horizontal. Capturas desktop/celular inspecionadas. Não representa auditoria formal de acessibilidade ou aceite do Google real.

As primeiras tentativas identificaram ajustes no rótulo do seletor e na sincronização do runner. Um redirecionamento inicial chegou à tela de erro OAuth do Google usando somente cliente fictício inválido; nenhum token ou autorização real foi obtido. A interceptação foi corrigida para abranger todas as requisições. Um ensaio interrompido deixou banco temporário, identificado pelo nome exclusivo e removido após confirmar o encerramento dos servidores de ensaio. A execução final terminou aprovada com limpeza normal.

Migration aplicada no desenvolvimento sem build. Comparação `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: sem diferenças. SHA-256 de todos os registros anteriores idêntico após migration/reinício: uma administradora, uma conta, uma sessão, sete respostas, cinco informações e uma configuração da assistente. Os exemplos continuam em revisão; nenhum evento fictício ou conta Google foi criado no desenvolvimento.

Regressão de navegador da etapa 2 reexecutada: **14 verificações aprovadas**. Conferência final: zero bancos temporários restantes e zero conexões/estados OAuth no desenvolvimento. Backend/frontend/PostgreSQL/n8n saudáveis; painel e prontidão HTTP 200, `/agenda` redireciona anônimos ao login e `/api/v1/calendar/status` responde 401 sem sessão. Serviços deixados em execução em `http://localhost:8080`, com dados/volumes e outros projetos Docker preservados. Nenhum build realizado.

Pendências para aceite real:

- Criar/configurar cliente Google Cloud, consentimento e permissões; cadastrar URI exata e ambiente privado.
- A doutora autorizar sua conta e selecionar uma agenda de teste; confirmar calendário/fuso/compartilhamento corretos.
- Validar leitura, criação, edição/reagendamento e cancelamento diretamente no Google, com dados fictícios; conferir que outros eventos e recorrências são preservados.
- Validar expiração, revogação, reconexão e indisponibilidade com o provedor real, sem duplicar consultas.
- Avaliar conflitos feitos por aplicativos externos e obter aceite de uso da doutora.
- Build/validação dos novos artefatos de produção/migrador dependem de pedido explícito. VPS, HTTPS e demais pendências operacionais continuam abertas.

WhatsApp/n8n, OpenAI real e revisão clínica da etapa 2 mantêm suas pendências próprias. Lembretes e agendamento automático por IA não foram antecipados nesta entrega.
