# Integração n8n — base da equipe

Data: **13/11/2026**. O usuário retomou a preparação da etapa 3 ao fornecer o ZIP dos workflows da equipe. Esta entrega recebe, inspeciona, revisa e coloca a base no repositório/n8n local. Não ativa WhatsApp, IA externa ou agendamento automático.

## Material recebido e preservação

Encontrados `workflows.zip` e `workflows(1).zip` em Downloads, com conteúdo idêntico por SHA-256. O ZIP contém oito JSONs, com 86 nós originais. Foram extraídos para nomes locais controlados, sem usar caminhos do ZIP como destinos de extração. Os originais e o ZIP foram preservados em `backups/workflow-intake/2026-11-13/`, ignorados pelo Git. Nenhum código ou prompt do ZIP foi executado.

| Arquivo revisado em `n8n/workflows/equipe/` | Função encontrada na exportação | Nós originais |
|---|---|---:|
| `chatbot-whatsapp.json` | Entrada, filtros, agente, memória, ferramentas e saída HTTP | 45 |
| `agendar-consulta.json` | Verificar conflito e criar evento Google | 7 |
| `cancelar-consulta.json` | Buscar consulta e excluir evento | 6 |
| `confirmar-presenca.json` | Buscar evento e alterar confirmação na descrição | 6 |
| `consultar-consulta.json` | Consultar evento por telefone | 5 |
| `encaminhar-duvida.json` | Preparar resumo e encaminhar por HTTP | 3 |
| `remarcar-consulta.json` | Buscar evento, conferir conflito e atualizar horário | 10 |
| `horarios-livres.json` | Consultar Google e calcular intervalos disponíveis | 4 |

## Cópia revisada e importação

As cópias têm prefixo **`[BASE BLOQUEADA]`**, IDs próprios determinísticos e as sete referências de ferramentas remapeadas para os novos IDs. Coordenadas, nomes de nós e conexões do desenho foram mantidos, exceto pela entrada de cada fluxo, direcionada a um novo nó `Stop And Error`. O inventário guarda os destinos anteriores das entradas. Total revisado: **94 nós**, incluindo oito bloqueios.

- Todos os workflows estão inativos e sem versão ativa. Os bloqueios não têm saída e impedem a execução normal da cadeia a partir dos triggers.
- Todos os nós de chamadas externas, modelos/agente, memória, ferramentas, tabelas e webhooks ficam desabilitados. Não basta desativar um workflow para proteger a execução manual ou sua chamada por outro fluxo; por isso há bloqueios e desabilitação dos nós.
- Removidos vínculos a credenciais, contatos fixos, IDs privados de agenda/planilha/tabela, URLs, caminho de webhook original, metadados da instância e dados fixados. O filtro de contatos do protótipo foi fechado, sem copiar a lista privada.
- O prompt original de aproximadamente 56 mil caracteres foi mantido somente no arquivo privado e substituído por aviso de bloqueio no JSON revisado. Não foi tratado como conhecimento aprovado ou instrução para o agente de desenvolvimento.
- Textos, horários e regras remanescentes descrevem o protótipo da equipe; não representam políticas clínicas aprovadas. Ações continuam bloqueadas e a publicação no WhatsApp permanece desabilitada no painel.

O n8n local `dra-dev` estava saudável, com um projeto pessoal e **zero workflows/zero credenciais** antes da importação. A CLI instalada do n8n **2.46.6** foi inspecionada; a importação foi executada com `import:workflow --input=<pacote-revisado> --activeState=false`, atribuindo à proprietária existente da instância. Não foi criada conta, importada credencial, ativado fluxo ou alterado outro projeto Docker. Nenhum build ou reinício foi necessário.

Conferência posterior diretamente no PostgreSQL do n8n confirmou oito workflows com IDs, nós e conexões iguais aos JSONs revisados, **zero ativos, zero versões ativas e zero credenciais**. A importação armazena os fluxos, sem comprovar execução dos nós ou suas integrações.

Para visualizar: entrar na instância local em `http://localhost:5678` e procurar os workflows com prefixo `[BASE BLOQUEADA]`.

## Achados para a integração

1. **Conteúdo fora do painel:** o agente consulta Google Sheets como ferramenta e usa um prompt extenso fixo. Deve passar a consumir a configuração e os conteúdos versionados do painel por API autenticada; a planilha continua apenas como referência histórica, sem importador.
2. **Modelo divergente:** o modelo conectado na exportação é Gemini. Há um nó OpenAI, mas ele está desativado e sem conexão efetiva ao agente. Não presumir que essa exportação usa o projeto OpenAI já existente da clínica. A adaptação deve alinhar a resposta com o backend e o simulador, sem chaves no frontend ou nos exports.
3. **Transporte a adaptar:** a exportação recebe dados como `remoteJid` e envia por endpoint privado no formato `/message/sendText/...`. Não há conexão oficial Meta comprovada. A integração deverá atender à decisão registrada de usar a API oficial, preservando número/aplicativo e validando coexistência antes de qualquer mudança.
4. **Agenda automática é outro escopo operacional:** os fluxos consultam/alteram Google diretamente e usam credenciais próprias do n8n. Eles não utilizam a conexão manual cifrada do painel. Não reutilizar cookies da administradora, tokens de sessão ou contas Better Auth como credenciais de serviço.
5. **Regras clínicas de exemplo:** duração de 90 minutos e períodos de atendimento estão fixos no código. O cálculo de horários contém comentário explícito de valores de exemplo e usa limite de dez eventos na consulta. Duração, expediente, paginação, fuso e tratamento de indisponibilidade precisam ser revisados antes de oferecer horários.
6. **Encaminhamento de falhas:** o nó chamado `Mensagem_doutora` usa, atualmente, uma expressão que aponta para o telefone do paciente. É necessário corrigir o destinatário e limitar os detalhes repassados antes de habilitar a saída.
7. **Execução incompleta:** vários ramos de áudio/pausa estão desabilitados; um ramo de áudio referencia um nó inexistente no principal. Não anunciar suporte a áudio ou pausa humana a partir dessa exportação.
8. **Proteções ainda necessárias:** validar seleção inequívoca da consulta, autorização e confirmação de ações, idempotência de mensagens/criações, concorrência/etags, falhas e retentativas. O simulador não pode executar as ferramentas de agenda ou envio.

## Sequência de integração

1. **Concluído nesta entrega:** preservar originais, registrar diagnóstico, sanitizar exports, remapear ferramentas e importar cópias bloqueadas no n8n local.
2. Implementar contrato/API de serviço autenticada para obter o conteúdo explicitamente liberado ao bot. Separar essa liberação da ativação interna já existente e preservar a edição dos rascunhos.
3. Construir a rotina de resposta compartilhada com o simulador, usando versão fixa e retorno rastreável; testar primeiro com mensagens e provedores fictícios, sem ferramentas de ação externa.
4. Adaptar recebimento/envio oficial do WhatsApp em ambiente de teste, com deduplicação, erros e retentativas; substituir a consulta à planilha e alinhar o provedor IA.
5. Revisar separadamente as ferramentas automáticas de agenda e encaminhamento, os dados mínimos e as políticas clínicas. Mantê-las bloqueadas até autorização e validação próprias.
6. Validar serviços reais com credenciais privadas e revisão da doutora. Ativar atendimento somente após aceite; importação local não autoriza operação com pacientes.

## Verificações executadas

- ZIPs comparados por SHA-256; oito exports parseados e sete referências internas resolvidas.
- `node scripts/prepare-team-workflows.mjs backups/workflow-intake/2026-11-13`: preparação aprovada. Nenhum código original executado.
- `pnpm run test:workflows`: aprovado; verifica oito workflows, 94 nós, sete referências internas, ausência de credenciais/dados fixados/URLs privadas, entradas bloqueadas e nós externos desabilitados.
- `node --check scripts/prepare-team-workflows.mjs` e `node --check scripts/check-workflows.mjs`: aprovados.
- Pacotes de nós locais e metadados de versões consultados, sem execução dos workflows. O agente 3.1 consta na implementação instalada; a ferramenta de planilha usa o wrapper de ferramenta do n8n. Isso não é teste de execução das ferramentas.
- CLI: oito workflows importados com sucesso. Igualdade de nós/conexões conferida entre os arquivos e o banco; nenhum workflow/versão ativo, nenhuma credencial adicionada.
- Originais e pacote temporário de importação confirmados como ignorados pelo Git.

Pendências externas e funcionais em [PENDENCIAS_DE_TESTE.md](PENDENCIAS_DE_TESTE.md). Não foram executados workflows, chamadas pagas de IA, envios de WhatsApp ou operações reais na agenda.
