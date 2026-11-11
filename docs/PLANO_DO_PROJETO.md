# Dashboard da Dra. Luciana — arquitetura e primeira versão

Data do planejamento: 07/11/2026.

Status: infraestrutura e autenticação implementadas e etapa 1 validada localmente, incluindo conjunto Docker, SMTP com capturador de teste, persistência e restauração completa em ambiente separado. VPS, DNS/HTTPS público, SMTP externo e backup fora da máquina continuam pendentes. Evidências em [RESULTADOS_VALIDACAO_ETAPA_1.md](RESULTADOS_VALIDACAO_ETAPA_1.md), operação em [INFRAESTRUTURA.md](INFRAESTRUTURA.md) e autenticação em [AUTENTICACAO.md](AUTENTICACAO.md).

Pendências de teste organizadas por etapa: [PENDENCIAS_DE_TESTE.md](PENDENCIAS_DE_TESTE.md).

## 1. Objetivo e decisões definidas

Construir um painel em que a clínica possa **editar respostas, ajustar o comportamento da assistente, simular conversas e publicar alterações para o bot**, sem precisar reprogramar o workflow.

O projeto atenderá exclusivamente à Dra. Luciana. A equipe poderá editar e simular; a doutora poderá publicar, restaurar versões e administrar acessos. O login será por e-mail e senha.

A primeira entrega concentra-se nas respostas. A gestão do Google Agenda fica para uma etapa posterior. O contrato fundamenta essa prioridade ao prever atualização de mensagens e autonomia para alterar o comportamento da IA.

## 2. Arquitetura

| Camada | Escolha |
|---|---|
| Frontend | Next.js com App Router e TypeScript |
| Estilos | Tailwind, CSS global para tokens visuais e shadcn/ui |
| API | Node.js LTS, Fastify e TypeScript |
| Banco | PostgreSQL com Prisma |
| Autenticação | Better Auth, com sessões persistidas no banco |
| Automação | n8n hospedado na VPS |
| Infraestrutura | Docker Compose e Caddy para proxy e HTTPS |

Fastify será escolhido pela organização e validação das APIs. A integração com outros serviços funciona tanto nele quanto em Express. Better Auth possui [integração documentada com Fastify](https://better-auth.com/docs/integrations/fastify); usaremos Prisma 7, atualmente compatível com seu [adaptador oficial](https://better-auth.com/docs/adapters/prisma).

Começaremos com PostgreSQL direto. O Supabase completo acrescentaria serviços e manutenção que não são necessários para esta primeira versão.

**Organização do código:** um repositório com frontend em `frontend/`, backend em `backend/` e contratos compartilhados em `packages/contracts/`, conforme alinhado após a revisão do planejamento. O gerenciamento de dependências será feito com pnpm, workspaces e um único `pnpm-lock.yaml`. O Next.js usará `frontend/src/app/` para o App Router. As regras de negócio ficarão na API; o n8n coordenará a automação.

**Hospedagem inicial:** VPS Linux com 4 vCPU, 8 GB de RAM e SSD de pelo menos 80 GB, como referência inicial sujeita à medição de consumo. Next.js, API, PostgreSQL, n8n e proxy terão contêineres separados. O n8n suporta oficialmente [instalação com Docker Compose](https://docs.n8n.io/deploy/host-n8n/install-options/install-using-docker-compose.md).

Frontend e API usarão o mesmo domínio, com a API sob `/api`. O PostgreSQL ficará acessível apenas pela rede interna. Aplicação e n8n terão bancos e usuários separados, mesmo compartilhando a instância PostgreSQL.

O n8n será hospedado na VPS, sem uso do n8n Cloud. A API oficial do WhatsApp e o serviço de IA continuarão sendo serviços externos.

## 3. Desenvolvimento por etapas

### Etapa 1 — Infraestrutura, banco e autenticação

- Preparar Docker Compose para desenvolvimento e produção, configurações por ambiente, versões fixadas e volumes persistentes.
- Implementar migrations, verificações de saúde, reinício dos serviços e logs sem credenciais ou conteúdo clínico desnecessário.
- Criar login, logout, recuperação de senha por SMTP e administração de usuários, sem cadastro público.
- Aplicar permissões na API: `admin` para a doutora e `editor` para a equipe.
- Usar cookies seguros, proteção das operações autenticadas e limitação de tentativas de login.
- Separar credenciais de usuários das credenciais de comunicação entre API e n8n.
- Configurar backups diários criptografados fora da VPS, incluindo banco, dados persistentes e a chave de criptografia do n8n.
- Documentar implantação, atualização e restauração em outra VPS.

**Aceite:** login e permissões funcionando; reiniciar os contêineres preserva os dados; um backup pode ser restaurado em ambiente separado.

Uma VPS única simplifica a operação, mas concentra a indisponibilidade. Docker facilita a portabilidade; backups e restauração testada completam essa estratégia.

### Etapa 2 — Protótipo e painel de conteúdo

A direção visual será clara e discreta, inspirada na simplicidade das interfaces Apple: fundo cinza muito claro, superfícies brancas, tipografia limpa, bordas suaves e espaçamento generoso. Azul escuro da marca nas ações principais e dourado em detalhes pontuais.

| Área | Função |
|---|---|
| Respostas | Buscar, categorizar, criar, editar, duplicar e desativar modelos |
| Simulador | Testar conversas com a versão publicada ou com um rascunho |
| Base de conhecimento | Manter informações da clínica e conteúdos aprovados |
| Assistente | Configurar apresentação, tom, limites e encaminhamento humano |
| Configurações | Usuários, integrações e histórico de publicações |

A página inicial será **Respostas**, dando acesso direto à tarefa principal.

No desktop, o editor terá lista de modelos, formulário e prévia da conversa. No celular, essas áreas serão divididas em abas. Cada modelo terá título, categoria, exemplos de perguntas, resposta-base, variações e estado de revisão.

As ações principais serão **Salvar rascunho**, **Simular** e **Publicar**. Variações geradas pela IA serão sugestões editáveis, sempre salvas como rascunho.

A planilha será importada com prévia e revisão. Respostas prontas, informações da clínica e instruções de fluxo serão separadas. Duração de consulta, cancelamento e respostas conflitantes sobre preço ficarão pendentes de validação.

**Aceite:** navegação responsiva, formulários acessíveis, conteúdo persistido e estados claros de carregamento, erro e alterações não salvas. Antes da integração real, qualquer simulação demonstrativa será identificada, e a publicação para o WhatsApp ficará desabilitada.

### Etapa 3 — Integração real com n8n e WhatsApp

Primeiro, inspecionar e exportar o workflow atual, que ainda está em testes. Depois, substituir o conteúdo fixo do prompt pela consulta à API do painel.

O funcionamento será:

1. O WhatsApp entrega uma mensagem ao fluxo.
2. O n8n consulta a API para obter a versão publicada, o contexto da conversa e os conteúdos relevantes.
3. A IA produz a resposta com essas informações.
4. O fluxo envia a resposta e registra a versão utilizada.

O painel não precisará reconfigurar o workflow a cada edição: **o conteúdo muda no banco, e o bot consulta a versão publicada**.

Simulador e WhatsApp reutilizarão o mesmo subworkflow de resposta. No simulador, envio de mensagens e ações externas serão bloqueados pela implementação. As conversas de teste ficarão separadas das conversas reais.

A conexão oficial será validada primeiro com recursos de teste da Meta. Preservar o número e o aplicativo atuais será uma condição para ativação; confirmaremos o processo de coexistência antes de qualquer mudança na conta.

**Aceite:** uma alteração publicada passa a orientar as próximas respostas; rascunhos permanecem isolados; a simulação permite conferir o comportamento e os conteúdos utilizados.

### Etapa posterior — Google Agenda

Desenvolver em uma entrega própria: conexão OAuth, seleção da agenda, disponibilidade, criação, reagendamento e cancelamento. O Google Calendar será a referência dos compromissos.

Até essa entrega, o bot usará o link de agendamento aprovado ou encaminhará o atendimento, sem prometer horários que não consultou.

## 4. Dados e interfaces entre os sistemas

A API terá rotas versionadas em `/api/v1`, contratos TypeScript compartilhados e documentação OpenAPI para:

- Modelos de resposta, conhecimento e configurações da assistente.
- Simulações e sugestões de variações.
- Publicação, histórico e restauração.
- Consulta dos conteúdos pelo n8n, com autenticação de serviço.

O banco guardará usuários e sessões, rascunhos, versões publicadas, histórico de alterações e contexto mínimo das conversas.

Cada publicação criará uma **versão imutável da configuração completa**, ativada em uma transação. Restaurar uma versão criará uma nova publicação baseada nela. A equipe poderá continuar editando sem modificar o conteúdo em uso.

Para reduzir contexto enviado à IA, começaremos com busca textual e exemplos de perguntas cadastrados, combinados com o estado da conversa. Respostas como “Sim” serão interpretadas considerando a pergunta anterior. Não será necessário adicionar banco vetorial na primeira versão.

Guardar conteúdo no PostgreSQL não elimina tokens automaticamente: a economia virá de enviar apenas regras, conteúdos e histórico necessários para cada resposta.

## 5. Validação e limites da primeira entrega

Os testes principais verificarão:

- Login, recuperação de senha, revogação de acesso e permissões.
- Edição sem alteração da versão publicada, publicação e restauração.
- Importação da planilha com itens incompletos e conteúdos conflitantes.
- Perguntas equivalentes, respostas curtas dependentes de contexto e encaminhamento humano.
- Uso da mesma versão e lógica no simulador e no WhatsApp, sem exigir respostas literalmente idênticas da IA.
- Falhas de API/IA, mensagens repetidas e retentativas sem envio duplicado.
- Persistência após reinício e restauração em outra instalação.

O bot iniciará com respostas a mensagens recebidas. Lembretes automáticos ficarão para a etapa de agenda, distinguindo modelos internos da IA dos templates aprovados pela Meta, exigidos fora da janela de atendimento de 24 horas. [Política oficial do WhatsApp](https://whatsappbusiness.com/policy/?iframe=yes).

Domínio, provedor da VPS, SMTP e credenciais serão configurados antes da implantação. A ativação dependerá da revisão dos conteúdos pela doutora e da validação da conexão oficial.

Não haverá builds automáticos. Builds serão executados somente mediante pedido explícito.

## 6. Materiais de referência

- [Contrato Dra. Luciana](materials/contrato_dra_luciana.pdf): escopo contratado e entregas previstas.
- [Template de Mensagens](materials/template_de_mensagens.xlsx): conteúdo inicial para importação e revisão.
- Logos da Dra. Luciana disponíveis em `frontend/public/images/logos/`, com nomes em `snake_case`: identidade visual do painel.

O contrato é referência de escopo e não será importado como conhecimento para as respostas do bot.
