# Workflows

Base da equipe recebida em **13/11/2026**, revisada e importada no n8n local como **oito workflows inativos e bloqueados**. Arquivos individuais em [equipe/](equipe/); inventário e IDs locais em [equipe.manifest.json](equipe.manifest.json). Diagnóstico, evidências e sequência de integração em [../../docs/INTEGRACAO_N8N.md](../../docs/INTEGRACAO_N8N.md).

Os fluxos preservam o desenho e as sete referências internas, mas não executam atendimento: cada entrada termina em um nó de bloqueio; HTTP, Google, modelos de IA, memória e chamadas de ferramentas estão desabilitados. URLs/contatos/IDs privados, vínculos a credenciais e dados fixados foram removidos. O prompt original não foi versionado; deverá ser substituído pelos conteúdos revisados do painel.

Os originais permanecem em `backups/workflow-intake/2026-11-13/`, ignorados pelo Git. Não importar o ZIP original diretamente sobre a instância existente nem remover os bloqueios para testar com pacientes.

Para validar a cópia revisada, execute `pnpm run test:workflows`. Para refazer a preparação a partir dos JSONs originais privados: `node scripts/prepare-team-workflows.mjs <diretorio-privado>`. Esse comando sobrescreve apenas as cópias revisadas e o inventário; não importa nem ativa nada no n8n. Não é executado na instalação/inicialização.

O futuro subworkflow compartilhado entre simulador e WhatsApp ainda será implementado. Importação não comprova conexão externa, uso do painel pelo bot ou autorização de agendamento automático.

Antes de versionar uma exportação, remover dados de pacientes, amostras de execução, URLs privadas e credenciais embutidas. As credenciais do n8n não devem ser exportadas para este repositório.
