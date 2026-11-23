# Pendências de teste por etapa

Atualizado em: 13/11/2026.

Referência de escopo: [PLANO_DO_PROJETO.md](PLANO_DO_PROJETO.md). Este documento acompanha os testes ainda pendentes; não substitui os resultados já registrados. Marcar um item como concluído somente após executá-lo e registrar ambiente, data e evidência do resultado.

## Etapa 1 — Infraestrutura, banco e autenticação

**Situação:** validação local concluída. Autenticação, permissões, SMTP local, imagens Docker, HTTPS local, persistência, isolamento dos bancos e backup/restauração foram aprovados. Evidências em [RESULTADOS_VALIDACAO_ETAPA_1.md](RESULTADOS_VALIDACAO_ETAPA_1.md).

As pendências abaixo dependem de infraestrutura e serviços externos ainda não configurados.

| Pendente | Dependência | Como testar e validar |
|---|---|---|
| [ ] Implantação na VPS | VPS Linux disponível | Implantar conforme o roteiro; verificar migrations, saúde dos serviços, acesso ao painel e n8n, login e permissões no ambiente real. |
| [ ] Acesso e firewall | VPS e regras de rede configuradas | Conferir externamente as portas expostas, acesso administrativo e ausência de acesso direto ao PostgreSQL e aos serviços internos. |
| [ ] Recursos e reinício do servidor | Aplicação implantada na VPS | Medir CPU, memória e disco durante uso representativo; reiniciar a VPS e confirmar retomada dos serviços, persistência dos dados e sessões ainda válidas. Registrar se os recursos contratados são suficientes. |
| [ ] DNS e HTTPS público | Domínio apontado para a VPS | Conferir resolução dos domínios, emissão ACME pelo Caddy, cadeia de confiança, redirecionamento HTTP para HTTPS e cookies seguros pelo domínio público. |
| [ ] Renovação dos certificados | HTTPS público funcionando | Conferir configuração, persistência dos dados do Caddy e logs; registrar evidência de renovação automática quando ocorrer. Emissão inicial não comprova renovação. |
| [ ] Recuperação de senha por e-mail real | Provedor SMTP e remetente configurados | Solicitar recuperação para conta de teste, confirmar entrega e link no domínio correto, concluir a troca e conferir rejeição da senha antiga e revogação das sessões anteriores. Verificar tratamento de indisponibilidade do provedor sem expor credenciais. |
| [ ] Backup fora da VPS | Destino externo e credenciais configurados | Executar a rotina real, confirmar snapshot criptografado no destino, integridade e acesso com a senha correta; conferir tratamento de falha de conexão. |
| [ ] Restauração a partir do destino externo | Backup externo disponível e instalação separada | Recuperar bancos, configurações, arquivos e chave do n8n; conferir login, permissões e decifragem de uma credencial fictícia. Manter ações externas desabilitadas no ambiente restaurado. |
| [ ] Agendamento diário | restic e service/timer systemd instalados na VPS | Observar uma execução automática, conferir logs, snapshot e retomada dos serviços. Validar retenção configurada de 7 diários, 4 semanais e 6 mensais conforme houver histórico disponível. |
| [ ] Alertas de falha | Canal de alerta operacional configurado | Provocar falha controlada de backup no ambiente de teste e confirmar notificação, registro do erro e retomada dos serviços. |

**Aceite operacional pendente:** aplicação funcionando na VPS pelo domínio público, recuperação por e-mail real e backup externo agendado com restauração e alertas comprovados. Revisão de arquivos systemd no Windows não equivale à execução no Linux.

## Etapa 2 — Protótipo e painel de conteúdo

**Situação atual:** implementação local de Respostas, Conhecimento, Assistente, versões imutáveis, ativação/restauração interna, simulador, sugestões editáveis de IA e OpenAPI concluída. Validação local com 44 testes de integração aprovados e 14 verificações de navegador. Conexão real OpenAI e revisão/aceite clínico pendentes. Publicação para WhatsApp continua desabilitada. Relatório atual: [VERSOES_SIMULADOR_IA.md](VERSOES_SIMULADOR_IA.md). Registros históricos de Respostas em [ETAPA_2_CONTEUDO.md](ETAPA_2_CONTEUDO.md).

Segundo incremento: Base de conhecimento e Assistente implementadas, com testes de API em PostgreSQL temporário. Evidências históricas em [CONHECIMENTO_ASSISTENTE.md](CONHECIMENTO_ASSISTENTE.md). A rodada seguinte acrescentou e verificou a navegação das novas áreas.

Também passaram 12 verificações no navegador para esse incremento, com banco e contas fictícias, cobrindo persistência, conflitos, navegação móvel, edição pela equipe e publicação desabilitada. A rodada final acrescentou 14 verificações de versões, simulação, sugestões e navegação, incluindo teclado e rótulo das sugestões. Isso não equivale a certificação/auditoria formal de acessibilidade.

Verificações já executadas no primeiro incremento:

- [x] Validar na API acesso de admin/editor aos rascunhos e rejeição de anônimos, usuários bloqueados, origem hostil e mutações sem JSON.
- [x] Validar criação, busca, categoria, revisão, paginação, edição concorrente sem sobrescrita, duplicação independente e desativação/reativação em PostgreSQL temporário.
- [x] Conferir ausência de rotas de publicação para WhatsApp e rejeição de acesso aos rascunhos por token de serviço. Agora existem rotas explícitas de ativação interna, somente admin.
- [x] Exercitar no navegador o primeiro incremento com contas fictícias: salvar/recarregar, buscar, duplicar, desativar/reativar, conflito preservando texto, abas móveis e edição pela equipe. Capturas desktop/celular e detalhes em [ETAPA_2_CONTEUDO.md](ETAPA_2_CONTEUDO.md). Auditoria completa de acessibilidade e navegação das áreas futuras continuam pendentes.
- [x] Confirmar prévia estática identificada como demonstrativa e botão de publicação para WhatsApp desabilitado no primeiro incremento.

Pendências do aceite da etapa, incluindo funcionalidades ainda futuras:

- [x] Conferir navegação nas áreas Respostas, Simulador, Base de conhecimento, Assistente e Configurações em desktop e celular. Abas dos editores verificadas nos incrementos anteriores; novas áreas sem overflow em 320/390/768/1024px. Runner `pnpm run test:browser`, 11/11/2026.
- [x] Validação funcional de teclado, rótulos, carregamento, erros e alterações não salvas nos fluxos exercitados. Corrigido rótulo das sugestões de IA; saída sem salvar e prévia obsoleta exercitadas. Não representa auditoria formal com tecnologias assistivas.
- [x] Conferir preservação dos registros existentes após migration/reinício sem build: SHA-256 dos usuários, contas, sessões e rascunhos idênticos; serviços de desenvolvimento retomados. Persistência dos fluxos novos ao recarregar/reabrir aplicação exercitada em banco temporário.
- [ ] Validação dos novos artefatos de produção e imagem do migrador com conteúdo atual: requer pedido explícito de build, conforme regra do usuário. Não é bloqueio funcional do painel em desenvolvimento; nenhum build autorizado nesta rodada.
- [x] Validar campos dos modelos na API: título, categoria, exemplos de perguntas, resposta-base, variações e estado de revisão, com limites e rejeição de campos desconhecidos. Evidência: suíte de respostas em PostgreSQL temporário, 11/11/2026.
- [x] Salvar informações da clínica e configurações da assistente; conferir validação e permissões na API. Evidência: 8 cenários da suíte de conhecimento/assistente com PostgreSQL e Better Auth reais, 11/11/2026; criação única, concorrência e consulta sem efeitos colaterais também aprovadas.
- Importador/classificação automática da planilha: **retirados do escopo** por esclarecimento do usuário. A planilha era referência de exemplos; conflitos clínicos continuam dependentes de aprovação.
- [x] Conferir sugestões editáveis e salvamento explícito como rascunho. API com provedor fictício valida saída sem modificar dados; navegador edita/adiciona/salva e invalida revisão. Chamada real OpenAI continua pendente.
- [x] Testar edição sem alterar versão, ativação interna pela admin e bloqueio para editor na API e interface.
- [x] Validar snapshots imutáveis completos, transação, concorrência, histórico e restauração em nova versão sem sobrescrever rascunhos. Trigger PostgreSQL também testada contra UPDATE/DELETE.
- [x] Revalidar modo demonstrativo explícito e bloqueio da publicação para WhatsApp. Conversas privadas, falhas, revisões e idempotência verificadas.
- [x] OpenAPI autenticada com contratos e referências locais verificadas na suíte de integração.
- [ ] Configurar chave e modelo do projeto OpenAI no ambiente privado do backend, sem enviar chaves pelo chat nem versioná-las. O projeto de API já existe, mas as credenciais/modelo ainda não estão configurados nesta aplicação.
- [ ] Validar disponibilidade, acesso ao modelo e limites do projeto; executar conversas e sugestões de variações com a OpenAI real, incluindo contexto, encaminhamento e tratamento de falhas. Até aqui, os testes de IA usaram somente provedor fictício; não comprovam funcionamento ou qualidade do serviço externo.
- [ ] Doutora revisar exemplos, confirmar informações/políticas e avaliar as respostas e variações geradas pela IA real. Registrar aprovação clínica antes de uso com pacientes.

Essas pendências de validação real da etapa 2 permanecem abertas durante o desenvolvimento da etapa 3. Avançar na implementação não representa aprovação clínica, integração externa validada ou autorização para ativar atendimento a pacientes. Nenhuma chamada paga foi realizada nesta rodada.

**Aceite local funcional comprovado nos fluxos exercitados:** navegação responsiva, persistência, rascunhos isolados, permissões e estados de interação. Permanecem o aceite clínico e a validação com o provedor real. O efeito de uma publicação no bot e a equivalência do subworkflow serão validados na etapa 3. Operação em produção mantém as pendências da etapa 1.

## Etapa 3 — Integração real com n8n e WhatsApp

**Prioridade alterada em 11/11/2026:** usuário adiou esta implementação e antecipou a agenda manual no painel. As pendências abaixo permanecem abertas; conectar Google Agenda não ativa WhatsApp/n8n.

**Situação em 13/11/2026:** preparação retomada pelo usuário. Oito workflows da equipe recebidos, revisados e importados no n8n local como cópias inativas e bloqueadas. Diagnóstico e evidências em [INTEGRACAO_N8N.md](INTEGRACAO_N8N.md). A integração com o painel, a resposta compartilhada e os serviços externos continuam pendentes. A importação não comprova atendimento WhatsApp, IA ou agenda automática funcionando.

- [x] Receber e inspecionar a exportação da equipe antes de alterá-la; preservar os originais, remover dados privados da cópia versionável e conferir os bloqueios. Oito cópias inativas importadas em 13/11/2026, sem execução dos workflows; evidências em [INTEGRACAO_N8N.md](INTEGRACAO_N8N.md).
- [ ] Adaptar a base recebida à API autenticada do painel, ao provedor IA escolhido e ao transporte oficial Meta; o fluxo original ainda depende de planilha, Gemini e endpoint privado de mensagens.
- [ ] Revisar separadamente duração/expediente, leitura completa de eventos, confirmação e identidade das consultas, concorrência e idempotência antes de habilitar qualquer ferramenta automática de agenda.
- [ ] Corrigir encaminhamento de falhas/destinatário e decidir o escopo de áudio/pausa humana; existem ramos desabilitados e referência a nó ausente no protótipo original.
- [ ] Validar autenticação de serviço entre n8n e API, separada das sessões de usuários, rejeitando credenciais ausentes ou inválidas.
- [ ] Confirmar consulta à versão publicada, aos conteúdos relevantes e ao contexto mínimo da conversa, sem acesso aos rascunhos no atendimento real.
- [ ] Publicar uma alteração e conferir seu uso nas próximas respostas, registrando a versão utilizada em cada atendimento.
- [ ] Restaurar uma versão e confirmar que a nova publicação orienta as respostas seguintes.
- [ ] Verificar que simulador e WhatsApp usam o mesmo subworkflow de resposta e a mesma versão selecionada; avaliar comportamento e conteúdo, sem exigir texto idêntico da IA.
- [ ] Confirmar que conversas de simulação ficam separadas das reais e que envio de mensagens e ações externas estão bloqueados pela implementação no simulador.
- [ ] Testar perguntas equivalentes, respostas curtas dependentes de contexto, como “Sim”, e encaminhamento humano conforme as regras aprovadas.
- [ ] Simular falhas da API e do serviço de IA, mensagens repetidas e retentativas; confirmar tratamento de erro sem envio duplicado.
- [ ] Validar recebimento e resposta com os recursos de teste oficiais da Meta antes da ativação real.
- [ ] Confirmar o processo de coexistência e a preservação do número e do aplicativo atuais antes de qualquer mudança na conta.
- [ ] Registrar a revisão dos conteúdos pela doutora e validar a conexão oficial antes da ativação para pacientes.
- [ ] Conferir logs da integração para evitar exposição de credenciais e conteúdo clínico desnecessário.

**Aceite pendente:** alterações publicadas orientam o bot, rascunhos permanecem isolados e o simulador permite verificar comportamento e conteúdos utilizados sem executar ações reais.

## Google Agenda — entrega antecipada antes da etapa 3

**Situação:** implementação local de OAuth, seleção, visualização e gestão manual concluída e testada com provedor fictício. API exclusiva de admin; dia/semana/mês, criação, reagendamento e cancelamento no próprio painel. Nenhuma conta Google real autorizada ou compromisso real alterado. Configuração, limites e evidências em [AGENDA_GOOGLE.md](AGENDA_GOOGLE.md).

- [x] Validar localmente OAuth/state/PKCE, expiração, uso único, vínculo à administradora, cifra dos tokens, seleção/revisão/geração da conexão e reconexão. Evidência: suíte `calendar.test.ts`, PostgreSQL temporário e provedor fictício, 11/11/2026.
- [x] Validar fuso IANA/DST, sobreposição, bloqueios de dia inteiro, concorrência, etags e idempotência após timeout. Dezesseis cenários novos de API; total de 61 testes aprovados, incluindo cinco agrupamentos, e um cenário SMTP pulado nesta rodada.
- [x] Exercitar interface: conexão com OAuth interceptado, seleção, horários, criação, conflito sem perder edição, reagendamento, alteração concorrente em duas abas, cancelamento, recorrências, somente leitura, teclado, persistência da conexão e bloqueio de editor. Treze verificações aprovadas em `pnpm run test:calendar:browser`, com contas/banco/provedor fictícios.
- [x] Conferir vistas dia/semana/mês em 320/390/768/1024/1536px sem overflow; capturas desktop/celular inspecionadas em `backups/validation/calendar/`, ignoradas pelo Git.
- [x] Aplicar migration aditiva no desenvolvimento e comparar schema/banco sem diferenças. Usuários, contas, sessão e todos os rascunhos anteriores preservados por SHA-256 antes/depois. Nenhuma credencial Google real adicionada.
- [ ] Configurar projeto Google Cloud com Calendar API, consentimento OAuth, cliente Web e URI de retorno exata; disponibilizar as três variáveis privadas do backend. Não enviar segredos pelo chat.
- [ ] Doutora autorizar a conta e selecionar uma agenda de teste; confirmar fuso, identidade, permissões e compartilhamento. Conferir requisitos/expiração do consentimento de teste e eventual verificação do aplicativo antes da operação real.
- [ ] Validar consulta, criação, reagendamento e cancelamento com confirmação na interface do Google Calendar, usando compromissos fictícios e preservando os demais eventos/séries.
- [ ] Validar expiração/revogação/reconexão e falhas reais do Google, inclusive retentativa após resultado incerto sem duplicar consulta.
- [ ] Avaliar conflitos feitos simultaneamente por aplicativos externos e registrar aceite de uso da doutora. A verificação prévia do painel não é uma trava atômica sobre todos os clientes Google.
- [ ] Validar novos artefatos de produção/migrador após pedido explícito de build, preservando as pendências operacionais de VPS/HTTPS e backup.

**Fora deste incremento:** lembretes pelo painel e agendamento automático por IA/WhatsApp. Se forem implementados, terão testes próprios, incluindo permissões, disponibilidade, notificações e templates Meta quando aplicáveis. Eventos com convidados/especiais/dia inteiro ficam somente leitura no painel; recorrências são gerenciadas por ocorrência.

Até a futura integração da agenda com o bot, manter link de agendamento aprovado ou encaminhamento humano; a IA não pode prometer horários consultados apenas pela administradora no painel.

## Registro de conclusão

Atualização visual de 12/11/2026: interface adaptada ao HTML fornecido pelo usuário, com barra inferior e Mais no celular, Assistente em cinco etapas, editores compactos e grade horária da agenda. Nove verificações da nova interface, 14 de regressão da etapa 2 e 14 da agenda aprovadas; typecheck dos três workspaces aprovado. Relatório em [INTERFACE_REFERENCIA.md](INTERFACE_REFERENCIA.md). Esses ensaios usam contas/bancos/provedores fictícios e não concluem nenhuma pendência externa acima. Nenhum build executado.

Ao concluir uma pendência, marcar o item e incluir a evidência abaixo ou vincular um relatório específico. Novos testes devem acompanhar as funcionalidades implementadas e as falhas encontradas.

| Etapa/item | Data | Ambiente | Resultado e evidência |
|---|---|---|---|
| Etapa 2 — API de rascunhos e campos dos modelos | 11/11/2026 | PostgreSQL temporário com Better Auth real | 7 cenários da suíte de respostas aprovados; detalhes em [ETAPA_2_CONTEUDO.md](ETAPA_2_CONTEUDO.md). Aceite completo da etapa e testes externos continuam pendentes. |
| Etapa 2 — fluxo de Respostas no navegador | 11/11/2026 | Next.js em desenvolvimento, API, Chromium e banco temporário | Fluxos admin/editor e desktop/celular aprovados, com prévia estática identificada e publicação desabilitada; relatório em [ETAPA_2_CONTEUDO.md](ETAPA_2_CONTEUDO.md). |
| Etapa 2 — conhecimento e assistente | 11/11/2026 | PostgreSQL temporário, Better Auth real e Chromium | 8 cenários novos de API e 12 verificações de navegador aprovados; registros e limites em [CONHECIMENTO_ASSISTENTE.md](CONHECIMENTO_ASSISTENTE.md). |
| Etapa 2 — versões, simulador, sugestões e OpenAPI | 11/11/2026 | PostgreSQL temporário, sessões reais, Chromium e provedor IA fictício isolado | 13 novos cenários de API; total 44 aprovados e 1 SMTP pulado. 14 verificações de navegador aprovadas; preservação de desenvolvimento e limites em [VERSOES_SIMULADOR_IA.md](VERSOES_SIMULADOR_IA.md). |
| Google Agenda antecipado | 11/11/2026 | PostgreSQL temporário, sessões reais, Chromium e provedor Google fictício/OAuth interceptado | 16 cenários novos de API; total 61 aprovados e 1 SMTP pulado. 13 verificações de navegador aprovadas. Conexão real e aceite pendentes; detalhes em [AGENDA_GOOGLE.md](AGENDA_GOOGLE.md). |
| Interface desktop/celular conforme protótipo HTML | 12/11/2026 | Next.js dev com cache isolado, PostgreSQL temporário, sessões reais, Chromium e provedores fictícios | Typecheck aprovado; 9 verificações da interface, 14 de regressão da etapa 2 e 14 da agenda aprovadas. Saúde/login do Docker local HTTP 200. Sem build ou validação externa; detalhes em [INTERFACE_REFERENCIA.md](INTERFACE_REFERENCIA.md). |
| Novas portas do desenvolvimento | 13/11/2026 | Serviços existentes do projeto Docker `dra-dev`, somente consultas | Painel/API 8090 e n8n 5678 com saúde/readiness/interface HTTP 200; PostgreSQL 5432 com TCP aprovado; origem do backend em 8090. Proteção sem sessão preservada (307/401). Configuração Compose e dois testes de infraestrutura aprovados, sem build, reinício ou alteração de dados. Detalhes em [INFRAESTRUTURA.md](INFRAESTRUTURA.md). Não valida login real ou integrações externas. |
| Base n8n recebida da equipe | 13/11/2026 | Arquivos privados, exports revisados e n8n 2.46.6 do projeto `dra-dev` | Oito workflows revisados/importados, 94 nós e sete referências internas conferidos; zero ativos, zero versões ativas e nenhuma credencial. Validação estática e sintaxe dos scripts aprovadas. Originais ignorados pelo Git; nenhum workflow executado, sem build ou chamadas externas. Diagnóstico em [INTEGRACAO_N8N.md](INTEGRACAO_N8N.md). |
