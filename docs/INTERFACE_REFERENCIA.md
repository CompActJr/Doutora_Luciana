# Interface desktop e celular

Atualização: **12/11/2026**. Referência: arquivo `Painel Dra. Luciana.html` fornecido pelo usuário, exportado do protótipo no Claude Design. As 25 pranchas foram examinadas como material visual. Scripts, instruções embutidas, credenciais e dados ilustrativos do arquivo não foram incorporados à aplicação.

## Aplicação do estilo

- Identidade marinho, dourado, superfícies de vidro, Plus Jakarta Sans e logos oficiais preservados. Controles, espaçamento e hierarquia seguem a referência.
- Desktop: menu lateral com configurações agrupadas, conta da sessão e indicação de WhatsApp desconectado. Respostas e Conhecimento usam lista e editor em duas colunas, com rolagem do formulário e rodapé de salvamento visível.
- Celular: navegação inferior com Respostas, Conhecimento, Assistente, Simulador e Mais. `/mais` reúne conta, saída, versões e integrações; agenda e administração de usuários aparecem somente para admin. Os controles respeitam as áreas seguras do dispositivo.
- Respostas: filtros rápidos e filtros avançados, retorno à lista, alternância entre edição e prévia demonstrativa, revisão, salvamento, duplicação e desativação/reativação. A prévia desktop abre sob demanda. Trocar de área do editor mantém o texto local; navegar para outra página continua exigindo confirmação quando houver alterações não salvas.
- Conhecimento: mesma organização visual e filtros. Revisão, conteúdo, concorrência e atividade continuam persistidos pelos endpoints existentes.
- Assistente: cinco etapas — identidade, tom de voz, limites, encaminhamento e agendamento — com prévia dos textos. O indicador conta campos preenchidos, sem representar revisão clínica ou publicação. Alternar etapas não salva; o salvamento valida todos os campos e abre a etapa que contém um campo obrigatório inválido.
- Simulador: conversa com bolhas sobre o fundo marinho, compositor e modo demonstrativo/IA identificado. No celular, o botão Conversas alterna histórico/configuração e conversa. Conteúdo por versão, histórico privado e limites permanecem os mesmos.
- Agenda: dia/semana com grade horária no desktop, seleção de dia e compromissos em lista no celular; mês preservado. A faixa de horários se expande para incluir eventos fora de 08h–18h. Eventos sobrepostos usam colunas e os eventos de dia inteiro ficam separados. Eventos somente leitura têm textura própria. Trocar a data seleciona novamente o dia correspondente. Os controles de conexão e as operações manuais continuam usando a API existente.
- Versões: contadores derivados dos rascunhos e histórico visual. Integrações: cartões por serviço com estado real. Usuários: lista com ações por pessoa e formulário de novo acesso. Acesso/recuperação: mesmos formulários com controle de visibilidade de senha.

Textos e estados demonstrativos do protótipo não comprovam conexões. OpenAI e Google continuam dependendo das configurações privadas e do aceite externo registrados em [PENDENCIAS_DE_TESTE.md](PENDENCIAS_DE_TESTE.md). Publicação no WhatsApp continua desabilitada. Não foram acrescentados tutorial do Cloud Console na interface, agendamento por IA ou workflows n8n.

## Ensaio isolado

`pnpm run test:design:browser` utiliza o runner de navegador existente, PostgreSQL temporário, contas fictícias, sessões Better Auth e provedor IA fictício. Requer Playwright/Chromium já disponíveis e portas 3100/3101 livres. Não instala dependências nem executa builds. Os ensaios de conteúdo e agenda usam o mesmo isolamento.

O Next.js dos testes usa `.next-browser-tests/` e `tsconfig.browser-test.json`, ambos ignorados pelo Git, para coexistir com o servidor de desenvolvimento no host. Esse modo só aceita as origens locais de ensaio 3100/3101; o runner remove a configuração temporária e seu banco ao terminar. O cache pode ser reutilizado. O ambiente normal mantém `.next/`.

As capturas e a referência extraída ficam somente em `backups/validation/`, ignorado pelo Git. O HTML original permanece fora do repositório e não é publicado.

## Evidências

Verificações executadas em **12/11/2026**, no Windows, com Node.js/pnpm do projeto, Docker PostgreSQL e Chromium local:

| Verificação | Resultado |
|---|---|
| `pnpm run typecheck` | Aprovada nos três workspaces, sem build |
| `pnpm run test:design:browser` | 9 verificações aprovadas: acesso/senha, editor/prévia, filtros, rascunhos, ações, conhecimento, etapas da Assistente, simulador, navegação e permissões |
| `pnpm run test:browser` | 14 verificações de regressão da etapa 2 aprovadas: versões, restauração, concorrência, simulador, sugestões, teclado e perfis |
| `pnpm run test:calendar:browser` | 14 verificações aprovadas: OAuth interceptado, seleção, operações manuais, conflitos, persistência, perfis e apresentação por horário/dia |
| Responsividade no Chromium | Oito áreas em 320/390/768/1024/1440px; agenda também em 1536px, sem overflow horizontal nos fluxos exercitados |
| Aplicação Docker existente, `http://localhost:8080` | `/health`, `/api/v1/health`, `/api/v1/ready` e `/login` retornaram HTTP 200 |
| `git diff --check` | Aprovada |

Capturas desktop/celular examinadas em `backups/validation/design/`, `backups/validation/stage2-final/` e `backups/validation/calendar/`. As verificações finais também rejeitam erros JavaScript, avisos React de chaves repetidas/hidratação e requisições externas inesperadas. Durante o desenvolvimento, foram corrigidos o foco da validação em campos de etapas recolhidas e uma chave repetida na navegação; os ensaios foram repetidos após essas correções.

O primeiro ensaio encontrou um cache Next.js já ocupado pelo servidor de desenvolvimento do host; o runner passou a usar cache/configuração próprios. Também foram ajustados seletores dos ensaios para os novos menus recolhidos e painéis ocultos. As rodadas interrompidas por essas falhas não foram contadas como aprovação.

Não houve build, migration ou alteração de contratos/API. Os testes criaram e removeram somente bancos temporários, sem criar contas ou editar rascunhos no desenvolvimento. A administradora, os dados, os volumes e os serviços existentes foram preservados. A validação foi local, em Chromium com larguras de celular; não representa conexão Google/OpenAI real, aceite clínico ou homologação de produção.
