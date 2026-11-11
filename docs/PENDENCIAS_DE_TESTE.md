# Pendências de teste por etapa

Atualizado em: 11/11/2026.

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

**Situação:** testes de funcionalidades futuras, dependentes da implementação desta etapa. As páginas de autenticação e os testes da etapa 1 não comprovam o funcionamento do painel de conteúdo.

- [ ] Conferir navegação nas áreas Respostas, Simulador, Base de conhecimento, Assistente e Configurações em desktop e celular, incluindo a divisão do editor em abas no celular.
- [ ] Validar formulários por teclado, rótulos, mensagens de validação e indicação de carregamento, erro e alterações não salvas.
- [ ] Criar, buscar, categorizar, editar, duplicar e desativar modelos; conferir persistência após recarregar e reiniciar os serviços.
- [ ] Validar campos dos modelos: título, categoria, exemplos de perguntas, resposta-base, variações e estado de revisão.
- [ ] Salvar informações da clínica e configurações da assistente; conferir validação e permissões na API.
- [ ] Importar a planilha com prévia e revisão; verificar itens incompletos e conflitos de preço, duração da consulta e cancelamento, mantendo-os pendentes de aprovação quando necessário.
- [ ] Confirmar que respostas prontas, informações da clínica e instruções de fluxo são classificadas separadamente na importação.
- [ ] Conferir que sugestões de variações da IA são editáveis e salvas como rascunho.
- [ ] Testar edição de rascunhos sem alteração da versão publicada, publicação pela administradora e bloqueio dessa ação para editor, inclusive na API.
- [ ] Validar versões imutáveis da configuração completa, ativação em transação, histórico e restauração criando uma nova publicação.
- [ ] Confirmar que qualquer simulação demonstrativa está identificada e que a publicação para WhatsApp permanece desabilitada antes da integração real.

**Aceite pendente:** painel responsivo e acessível, conteúdo persistido, rascunhos isolados e estados de interação claros. O efeito de uma publicação no bot será validado na etapa 3.

## Etapa 3 — Integração real com n8n e WhatsApp

**Situação:** testes futuros, dependentes do painel de conteúdo, do workflow atual e das credenciais de teste dos serviços externos. O n8n iniciado e restaurado na etapa 1 não representa integração com WhatsApp ou IA validada.

- [ ] Inspecionar e exportar o workflow atual antes de alterá-lo; conferir uma cópia de teste sem ações sobre conversas reais.
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

## Etapa posterior — Google Agenda

**Situação:** fora da primeira entrega; testes dependentes do planejamento e da implementação próprios desta integração.

- [ ] Validar conexão OAuth, seleção da agenda, expiração e revogação do acesso.
- [ ] Conferir consulta de disponibilidade usando o Google Calendar como referência, incluindo fuso horário e conflitos de horário.
- [ ] Testar criação, reagendamento e cancelamento em agenda de teste, com confirmação no Google Calendar.
- [ ] Simular falhas e retentativas sem criar compromissos duplicados.
- [ ] Caso lembretes sejam implementados, validar agendamento, cancelamento e uso dos templates aprovados pela Meta quando exigidos.

Até essa entrega, conferir na etapa 3 que o bot utiliza o link de agendamento aprovado ou encaminha o atendimento, sem prometer horários que não consultou.

## Registro de conclusão

Ao concluir uma pendência, marcar o item e incluir a evidência abaixo ou vincular um relatório específico. Novos testes devem acompanhar as funcionalidades implementadas e as falhas encontradas.

| Etapa/item | Data | Ambiente | Resultado e evidência |
|---|---|---|---|
| — | — | — | Nenhuma pendência deste documento concluída até esta atualização. |
