# Plano de configuração e validação local — etapa 1

Data: 10/11/2026.

Execução local concluída: conjunto Docker, autenticação, SMTP local, persistência e recuperação independente aprovados. Evidências e dependências externas em [RESULTADOS_VALIDACAO_ETAPA_1.md](RESULTADOS_VALIDACAO_ETAPA_1.md); roteiro de repetição em [ENSAIO_LOCAL_ETAPA_1.md](ENSAIO_LOCAL_ETAPA_1.md).

Objetivo: validar infraestrutura, banco, autenticação, recuperação de senha e recuperação de dados no computador local. A conta administradora existente será preservada. A etapa será classificada como validada localmente apenas com evidências dos testes abaixo; VPS, DNS público, certificados públicos e operação externa permanecem pendentes.

## 1. Preparação e separação dos ambientes

- Conferir Docker, Compose, pnpm, arquivos de ambiente e disponibilidade das portas.
- Iniciar o Docker se necessário, sem alterar contêineres de outros projetos.
- Executar tipagem, testes unitários, validação Prisma e testes da topologia Compose.
- Usar bancos e volumes exclusivos para testes destrutivos e restauração, sem remover os volumes de `dra-dev` ou a conta já cadastrada.
- Manter segredos em arquivos ignorados pelo Git; registrar apenas presença das variáveis e resultados, nunca valores, tokens ou senhas.
- Executar builds apenas após autorização explícita para esta rodada, conforme preferência do usuário.

Aceite: ferramentas operacionais, ambiente identificado e verificações básicas sem falhas.

## 2. Imagens e conjunto Docker de desenvolvimento

- Construir imagens autorizadas e corrigir falhas de dependências, inicialização e permissões que os testes evidenciarem.
- Inicializar PostgreSQL, migrations, API, frontend, n8n e Caddy com os arquivos Compose do projeto.
- Conferir término bem-sucedido das migrations e saúde dos serviços.
- Verificar painel e API pela mesma origem do Caddy; verificar acesso ao editor n8n.
- Confirmar que as portas de desenvolvimento ficam vinculadas a `127.0.0.1`.
- Testar acesso aos logos e aos arquivos estáticos; os documentos internos não podem ser servidos.

Aceite: serviços funcionando em conjunto, sem falhas recorrentes, proxy correto e nenhuma porta de desenvolvimento aberta para a rede.

## 3. Autenticação, administração e persistência

- Executar a suíte existente em PostgreSQL temporário: login, logout, permissões, bloqueio, revogação, proteção de origem, limite de tentativas e cookies.
- Repetir verificações HTTP passando pelo Caddy em um ambiente de ensaio com contas fictícias.
- Verificar que uma sessão válida continua utilizável após reinício dos processos/contêineres, respeitando sua validade.
- Confirmar persistência de usuários, migrations e arquivos do n8n após reinício e recriação de contêineres sem apagar volumes.
- Conferir isolamento entre os usuários PostgreSQL da aplicação e do n8n.
- Verificar erros e logs para evitar exposição de credenciais, cookies ou conteúdo de requisições.

Aceite: controles de acesso efetivos na API, dados preservados e contas reais intactas.

## 4. Recuperação de senha com transporte SMTP

- Confirmar se há credenciais de um provedor ou utilizar um capturador SMTP local, sem enviar mensagens externas.
- Validar transporte TLS e confiança do certificado; não desabilitar a validação de certificados para aprovar o teste.
- Solicitar recuperação para uma conta fictícia, capturar/receber a mensagem e verificar remetente e destino do link.
- Redefinir a senha e confirmar login com a nova senha, rejeição da antiga e revogação de sessões anteriores.
- Testar link inválido, expirado, reutilizado, e-mail inexistente e indisponibilidade SMTP.
- Identificar o resultado como SMTP local ou entrega externa real, conforme o transporte usado.

Aceite local: mensagem realmente transmitida por SMTP e fluxo completo concluído. Entrega por provedor externo só será considerada validada com configuração e teste reais.

## 5. Imagens de produção em ensaio local

- Construir os alvos de produção autorizados e iniciar um projeto Compose separado com segredos, volumes e portas próprios.
- Conferir execução de migrations, backend compilado e Next.js standalone, sem montagem do código do host.
- Exercitar HTTPS local com confiança explícita em uma CA de teste, quando possível, sem tratá-lo como validação de certificado público.
- Conferir cookies Secure, origem HTTPS, acesso às páginas protegidas, arquivos estáticos e ausência de portas públicas para API/banco/n8n.
- Repetir login e saúde dos serviços após reinício.

Aceite: artefatos de produção inicializam e funcionam localmente. DNS, ACME público e características da VPS continuam pendentes.

## 6. Backup criptografado e restauração isolada

- Preparar um repositório restic de ensaio, separado dos volumes da aplicação, com senha própria.
- Executar a rotina real de backup, adaptando apenas os parâmetros necessários ao ensaio local.
- Conferir exportação dos dois bancos, dados do n8n, chave de criptografia, configurações e arquivos necessários à recuperação.
- Validar integridade e recusar acesso ao repositório com senha incorreta.
- Restaurar o snapshot em outro projeto Docker, usando volumes vazios e dados fictícios.
- Confirmar login, permissões, registros, arquivos persistentes e capacidade de decifrar uma credencial fictícia do n8n com a chave original.
- Manter o n8n restaurado sem ações externas; não conectar WhatsApp, Google ou IA reais.
- Simular uma falha controlada de backup e conferir retorno de erro e retomada dos serviços.

Aceite local: backup criptografado restaurável e aplicação recuperada em instalação independente. Um repositório no mesmo computador não representa proteção fora da máquina nem backup externo já contratado.

## 7. Agendamento, documentação e conclusão

- Validar sintaxe e parâmetros da rotina e dos arquivos systemd; o timer Linux só será ativado no servidor apropriado.
- Registrar comandos, resultados, correções, limitações e instruções de repetição em um relatório.
- Separar resultados aprovados, falhas e verificações pendentes por dependência externa.
- Encerrar somente os recursos temporários criados para os testes, preservando o ambiente do usuário e snapshots de ensaio identificados.

Pendências externas previstas: VPS, domínio/DNS, certificado público, agendamento operacional, armazenamento fora da máquina, alertas operacionais e entrega de e-mail externa se não houver provedor configurado.

## Registro inicial

- Primeira administradora: criação confirmada pelo usuário.
- Docker Engine: encontrado parado na inspeção inicial; iniciado nesta rodada.
- SMTP: sem servidor/remetente configurados no `.env` na inspeção inicial.
- Builds: autorizados explicitamente pelo usuário e executados localmente no Docker Desktop, sem publicação.
- Verificações básicas e autenticação com PostgreSQL temporário: aprovadas.
- Capturador SMTP local: mensagem recebida por STARTTLS, recuperação e login com senha nova aprovados.
- Detalhes e pendências em [RESULTADOS_VALIDACAO_ETAPA_1.md](RESULTADOS_VALIDACAO_ETAPA_1.md).
