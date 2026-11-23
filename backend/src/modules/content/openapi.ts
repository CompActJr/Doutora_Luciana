// OpenAPI 3.1 da API do painel; sem credenciais, dados reais ou endpoints de envio.
import { calendarPaths, calendarSchemas } from "../calendar/openapi.js";
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const str = (maxLength = 6000, minLength = 1) => ({ type: "string", minLength, maxLength });
const integer = { type: "integer", minimum: 1, maximum: 2147483646 };
const uuid = { type: "string", format: "uuid" };
const nullableUuid = { type: ["string", "null"], format: "uuid" };
const array = (items: object, maxItems = 20) => ({ type: "array", items, maxItems });
const object = (properties: Record<string, object>, required = Object.keys(properties), additionalProperties = false) => ({ type: "object", properties, required, additionalProperties });
const responseInput = { title: str(120, 3), category: str(80), questionExamples: array(str(500)), answer: str(), variations: array(str(), 10), reviewStatus: { enum: ["draft", "needs_review", "reviewed"] } };
const knowledgeInput = { title: str(120, 3), category: str(80), content: str(12000), reviewStatus: responseInput.reviewStatus };
const assistantInput = { displayName: str(80), introduction: str(2000), tone: str(2000), boundaries: str(4000), handoffTriggers: { ...array(str(300)), minItems: 1 }, handoffMessage: str(3000), schedulingInstructions: str(2000) };
const timestamps = { createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } };
const metadata = { id: uuid, revision: integer, isActive: { type: "boolean" }, ...timestamps };
const versionProperties = { id: uuid, number: integer, fingerprint: { type: "string", pattern: "^[a-f0-9]{64}$" }, note: str(500, 3), actorId: str(), restoredFrom: nullableUuid, createdAt: timestamps.createdAt };
const activation = { fingerprint: versionProperties.fingerprint, expectedActiveVersionId: nullableUuid, note: str(500, 3), confirmInternalOnly: { const: true } };
const parametersId = [{ name: "id", in: "path", required: true, schema: uuid }];
const query = (name: string, schema: object) => ({ name, in: "query", schema });
const page = query("page", { ...integer, maximum: 100000, default: 1 });
const errors = Object.fromEntries([400, 401, 403, 404, 409, 415, 429, 500, 503].map((status) => [status, { description: ({ 400: "Dados inválidos", 401: "Sessão ausente, expirada ou acesso bloqueado", 403: "Perfil ou origem sem permissão", 404: "Registro ausente ou conversa de outro usuário", 409: "Revisão obsoleta, operação concorrente ou conteúdo sem revisão", 415: "Corpo deve ser JSON", 429: "Limite de solicitações atingido", 500: "Falha interna sem detalhes sensíveis", 503: "Serviço de IA ou SMTP indisponível" } as Record<number, string>)[status], content: { "application/json": { schema: ref("Error") } } }]));
function operation(summary: string, result: object, body?: object, options: { status?: number; parameters?: object[]; description?: string } = {}) {
  return { summary, ...(options.description ? { description: options.description } : {}), ...(options.parameters ? { parameters: options.parameters } : {}),
    ...(body ? { requestBody: { required: true, content: { "application/json": { schema: body } } } } : {}),
    responses: { [options.status ?? 200]: { description: "Sucesso", content: { "application/json": { schema: result } } }, ...errors } };
}
const listFilters = [query("search", str(200, 0)), query("category", str(80)), query("state", { enum: ["active", "inactive", "all"], default: "active" }), query("reviewStatus", responseInput.reviewStatus), page];
const list = (name: string, summaryName: string) => object({ items: array(ref(summaryName), 20), total: { type: "integer", minimum: 0 }, page: integer, pageSize: { const: 20 }, categories: array(str(80), 10000) });
const admin = "Somente admin. Exige Origin exatamente igual a APP_ORIGIN e JSON. Ativa apenas no painel; não altera n8n nem WhatsApp. Conflitos retornam 409 e exigem atualizar a prévia.";

export const panelOpenApi = {
  openapi: "3.1.0", info: { title: "Painel da Dra. Luciana — API", version: "0.2.0", description: "API privada. Admin/editor editam e simulam; somente admin ativa/restaura versões internas e administra usuários. Todas as mutações exigem Origin exata e Content-Type application/json. Nenhum endpoint envia mensagens ou publica no WhatsApp. Datas em ISO 8601; snapshots usam schemaVersion 1. Documentação de autenticação detalhada em docs/AUTENTICACAO.md." },
  servers: [{ url: "/api/v1" }], security: [{ session: [] }, { secureSession: [] }],
  paths: {
    ...calendarPaths,
    "/me": { get: operation("Usuário autenticado", object({ user: ref("User") })) },
    "/health": { get: { ...operation("Saúde da API", object({ status: { const: "ok" } })), security: [] } },
    "/ready": { get: { ...operation("Prontidão do banco", object({ status: { enum: ["ready", "unavailable"] } })), security: [] } },
    "/responses": { get: operation("Buscar rascunhos de respostas", ref("ResponsesList"), undefined, { parameters: listFilters }), post: operation("Criar resposta como rascunho", object({ response: ref("Response") }), ref("ResponseInput"), { status: 201 }) },
    "/responses/{id}": { get: operation("Consultar resposta", object({ response: ref("Response") }), undefined, { parameters: parametersId }), patch: operation("Editar resposta com revisão otimista", object({ response: ref("Response") }), object({ ...responseInput, revision: integer, isActive: { type: "boolean" } }, ["revision"]), { parameters: parametersId, description: "Informe pelo menos um campo além de revision. Editar conteúdo sem informar reviewStatus invalida a revisão anterior. Não altera versões salvas." }) },
    "/responses/{id}/duplicate": { post: operation("Duplicar resposta em rascunho independente", object({ response: ref("Response") }), object({ revision: integer }), { parameters: parametersId, status: 201 }) },
    "/responses/{id}/variations": { post: operation("Sugerir variações com OpenAI", object({ suggestions: array(str(), 3), revision: integer }), object({ revision: integer }), { parameters: parametersId, description: "Não modifica o modelo. Requer conexão OpenAI. Até 10 solicitações reais de IA/minuto/usuário, compartilhadas com o simulador. Sugestões devem ser revisadas e salvas explicitamente como rascunho." }) },
    "/knowledge": { get: operation("Buscar conhecimento em rascunho", ref("KnowledgeList"), undefined, { parameters: listFilters }), post: operation("Criar informação", object({ entry: ref("Knowledge") }), ref("KnowledgeInput"), { status: 201 }) },
    "/knowledge/{id}": { get: operation("Consultar informação", object({ entry: ref("Knowledge") }), undefined, { parameters: parametersId }), patch: operation("Editar conhecimento com revisão otimista", object({ entry: ref("Knowledge") }), object({ ...knowledgeInput, revision: integer, isActive: { type: "boolean" } }, ["revision"]), { parameters: parametersId }) },
    "/assistant-settings": { get: operation("Consultar configuração única sem criar registro", object({ settings: { anyOf: [ref("Assistant"), { type: "null" }] } })), put: operation("Salvar configuração da assistente", object({ settings: ref("Assistant") }), object({ ...assistantInput, revision: { type: "integer", minimum: 0, maximum: 2147483646 } }), { description: "revision=0 cria; atualizações exigem a revisão atual. ID fixo clinic." }) },
    "/content/draft": { get: operation("Prévia consistente da configuração completa", object({ snapshot: ref("Snapshot"), fingerprint: versionProperties.fingerprint, issues: array(str(), 100), activeVersionId: nullableUuid })) },
    "/content/versions": { get: operation("Histórico de versões internas", object({ items: array(ref("VersionSummary"), 20), total: { type: "integer", minimum: 0 }, page: integer, pageSize: { const: 20 }, activeVersionId: nullableUuid }), undefined, { parameters: [page] }), post: operation("Criar e ativar versão interna imutável", object({ version: ref("Version") }), object(activation), { status: 201, description: `${admin} Exige configuração da assistente, conteúdo ativo e revisão de todos os itens ativos. O fingerprint deve corresponder à prévia atual.` }) },
    "/content/versions/{id}": { get: operation("Consultar snapshot completo e imutável", object({ version: ref("Version") }), undefined, { parameters: parametersId }) },
    "/content/versions/{id}/restore": { post: operation("Restaurar criando outra versão interna", object({ version: ref("Version") }), object({ expectedActiveVersionId: nullableUuid, note: str(500, 3), confirmInternalOnly: { const: true } }), { parameters: parametersId, status: 201, description: `${admin} Não sobrescreve rascunhos. restoredFrom identifica a origem.` }) },
    "/ai/status": { get: operation("Consultar presença de configuração OpenAI", object({ available: { type: "boolean" }, model: { type: ["string", "null"] }, whatsappEnabled: { const: false } }), undefined, { description: "Não testa saldo ou conexão externa; não realiza chamadas pagas e não expõe chaves." }) },
    "/simulations": { get: operation("Últimas 50 conversas do próprio usuário", object({ items: array(ref("Simulation"), 50) })), post: operation("Iniciar teste com cópia fixa do conteúdo", object({ simulation: ref("Simulation") }), object({ mode: { enum: ["demo", "openai"] }, versionId: nullableUuid }), { status: 201, description: "versionId=null copia os rascunhos atuais, inclusive em revisão. mode=demo não usa IA. mode=openai exige configuração do servidor. Limite de 50 conversas por usuário. Não há destinatários ou ferramentas externas." }) },
    "/simulations/{id}": { get: operation("Reabrir conversa própria", object({ simulation: ref("Simulation") }), undefined, { parameters: parametersId }), delete: operation("Excluir conversa própria sem processamento ativo", object({ success: { const: true } }), object({}), { parameters: parametersId }) },
    "/simulations/{id}/messages": { post: operation("Testar resposta sem enviar mensagens externas", object({ simulation: ref("Simulation") }), object({ content: str(2000), revision: integer, requestId: uuid }), { parameters: parametersId, description: "Até 20 perguntas por conversa. requestId identifica a tentativa: repetir o mesmo ID após sucesso retorna a conversa sem gerar resposta duplicada. Falhas preservam mensagens anteriores; nenhuma retentativa automática da OpenAI. Revisão obsoleta ou processamento concorrente retorna 409. Busca textual envia até 5 conteúdos e 12 mensagens como contexto. sources indica contexto fornecido, não comprova utilização pela IA." }) },
    "/users": { get: operation("Listar até 200 usuários (admin)", object({ users: array(ref("User"), 200) })), post: operation("Criar acesso (admin)", object({ user: ref("User") }), object({ name: str(100, 2), email: { type: "string", format: "email" }, password: str(128, 12), role: { enum: ["admin", "editor"] } }), { status: 201 }) },
    "/users/{id}": { patch: operation("Alterar acesso e revogar sessões (admin)", object({ user: ref("User") }), object({ role: { enum: ["admin", "editor"] }, disabled: { type: "boolean" } }, []), { parameters: [{ name: "id", in: "path", required: true, schema: str() }], description: "Exige pelo menos um campo e preserva o próprio acesso administrativo e uma administradora ativa." }) },
    "/users/{id}/revoke-sessions": { post: operation("Revogar sessões (admin)", object({ success: { const: true } }), object({}), { parameters: [{ name: "id", in: "path", required: true, schema: str() }] }) },
    "/openapi.json": { get: operation("Documento OpenAPI autenticado", { type: "object" }) },
  },
  components: {
    securitySchemes: { session: { type: "apiKey", in: "cookie", name: "better-auth.session_token" }, secureSession: { type: "apiKey", in: "cookie", name: "__Secure-better-auth.session_token" } },
    schemas: {
      ...calendarSchemas,
      Error: object({ message: str() }),
      User: object({ id: str(), name: str(), email: { type: "string", format: "email" }, role: { enum: ["admin", "editor"] }, disabled: { type: "boolean" }, createdAt: timestamps.createdAt }),
      ResponseInput: object(responseInput), Response: object({ ...responseInput, ...metadata }),
      ResponseSummary: object({ id: uuid, title: responseInput.title, category: responseInput.category, reviewStatus: responseInput.reviewStatus, isActive: metadata.isActive, revision: integer, updatedAt: timestamps.updatedAt }),
      ResponsesList: list("responses", "ResponseSummary"),
      KnowledgeInput: object(knowledgeInput), Knowledge: object({ ...knowledgeInput, ...metadata }),
      KnowledgeSummary: object({ id: uuid, title: knowledgeInput.title, category: knowledgeInput.category, reviewStatus: knowledgeInput.reviewStatus, isActive: metadata.isActive, revision: integer, updatedAt: timestamps.updatedAt }),
      KnowledgeList: list("knowledge", "KnowledgeSummary"),
      Assistant: object({ ...assistantInput, id: { const: "clinic" }, revision: integer, ...timestamps }),
      Snapshot: object({ schemaVersion: { const: 1 }, responses: { type: "array", items: ref("Response") }, knowledge: { type: "array", items: ref("Knowledge") }, assistant: { anyOf: [ref("Assistant"), { type: "null" }] } }),
      VersionSummary: object(versionProperties), Version: object({ ...versionProperties, snapshot: ref("Snapshot") }),
      Message: object({ role: { enum: ["user", "assistant"] }, content: str(), requestId: uuid, sources: array(object({ id: uuid, title: str(120), kind: { enum: ["response", "knowledge"] } }), 5) }, ["role", "content"]),
      Simulation: object({ id: uuid, mode: { enum: ["demo", "openai"] }, versionId: nullableUuid, fingerprint: versionProperties.fingerprint, messages: array(ref("Message"), 40), revision: integer, ...timestamps }),
    },
  },
};
