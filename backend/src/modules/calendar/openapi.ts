const text = (maxLength = 1024) => ({ type: "string", maxLength });
const uuid = { type: "string", format: "uuid" };
const nullableText = { type: ["string", "null"] };
const revision = { type: "integer", minimum: 1 };
const object = (properties: Record<string, object>, required = Object.keys(properties)) => ({ type: "object", properties, required, additionalProperties: false });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const version = { connectionRevision: revision, connectionGeneration: uuid };
const input = { title: { type: "string", minLength: 3, maxLength: 120 }, notes: text(2000), startLocal: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$" }, endLocal: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$" }, ...version };
const errors = Object.fromEntries([400, 401, 403, 404, 409, 415, 429, 503].map((status) => [status, { description: "Erro seguro de validação, acesso, concorrência ou provedor; nenhum token retornado.", content: { "application/json": { schema: ref("Error") } } }]));
const operation = (summary: string, result: object, body?: object, status = 200) => ({ summary, tags: ["Google Agenda"], description: "Somente admin. Mutações exigem Origin exata e JSON. Google é a fonte dos compromissos. Sem integração WhatsApp, lembretes ou agendamento por IA.", ...(body ? { requestBody: { required: true, content: { "application/json": { schema: body } } } } : {}), responses: { [status]: { description: "Sucesso", content: { "application/json": { schema: result } } }, ...errors } });
const id = [{ name: "id", in: "path", required: true, schema: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,1024}$" } }];
export const calendarSchemas = {
  CalendarChoice: object({ id: text(), name: text(), timeZone: text(), primary: { type: "boolean" } }),
  CalendarStatus: object({ configured: { type: "boolean" }, connected: { type: "boolean" }, needsReconnect: { type: "boolean" }, email: nullableText, calendar: { anyOf: [ref("CalendarChoice"), { type: "null" }] }, revision: { type: "integer", minimum: 0 }, generation: { type: ["string", "null"], format: "uuid" }, redirectUri: { type: "string", format: "uri" } }),
  Appointment: object({ id: text(), etag: text(500), title: text(), notes: { type: "string" }, start: { type: "string", description: "RFC3339 em eventos com horário; YYYY-MM-DD para dia inteiro." }, end: { type: "string", description: "Fim exclusivo em eventos de dia inteiro." }, allDay: { type: "boolean" }, recurring: { type: "boolean" }, editable: { type: "boolean" }, transparent: { type: "boolean" } }),
  AppointmentInput: object(input),
};
export const calendarPaths = {
  "/calendar/status": { get: operation("Estado da configuração/conexão, sem consultar Google ou expor tokens", ref("CalendarStatus")) },
  "/calendar/connect": { post: operation("Iniciar OAuth com state de uso único e PKCE; expira em 10 minutos", object({ authorizationUrl: { type: "string", format: "uri" } }), object({})) },
  "/calendar/oauth/callback": { get: { summary: "Retorno Google vinculado à sessão da admin que iniciou OAuth", tags: ["Google Agenda"], parameters: [{ name: "state", in: "query", required: true, schema: text(128) }, { name: "code", in: "query", schema: text(4096) }, { name: "error", in: "query", schema: text(200) }], responses: { 302: { description: "Redireciona para /agenda?connection=connected|denied|failed, sem tokens." }, ...errors } } },
  "/calendar/calendars": { get: operation("Listar agendas com permissão de edição da conta conectada", object({ items: { type: "array", items: ref("CalendarChoice") } })) },
  "/calendar/selection": { put: operation("Selecionar agenda e fuso; rejeita conexão obsoleta", object({ success: { const: true } }), object({ calendarId: text(), ...version })) },
  "/calendar/disconnect": { post: operation("Remover credencial local e tentar revogação Google, preservando eventos", object({ success: { const: true }, revoked: { type: "boolean", description: "Se false, confirme revogação na conta Google." } }), object(version)) },
  "/calendar/events": {
    get: { ...operation("Consultar eventos no período (até 42 dias), expandindo recorrências", object({ items: { type: "array", items: ref("Appointment") }, timeZone: text(), calendarId: text(), connectionRevision: revision, fetchedAt: { type: "string", format: "date-time" } })), parameters: [{ name: "from", in: "query", required: true, schema: { type: "string", format: "date" } }, { name: "to", in: "query", required: true, schema: { type: "string", format: "date", description: "Limite exclusivo no fuso da agenda." } }, ...Object.entries(version).map(([name, schema]) => ({ name, in: "query", required: true, schema }))] },
    post: operation("Criar consulta após verificar sobreposição; requestId permite retry sem duplicação", object({ event: ref("Appointment") }), object({ ...input, requestId: uuid }), 201),
  },
  "/calendar/events/{id}": {
    patch: { ...operation("Editar/reagendar evento com etag e If-Match; máximo 12h; somente esta ocorrência", object({ event: ref("Appointment") }), object({ ...input, etag: text(500) })), parameters: id },
    delete: { ...operation("Cancelar consulta com confirmação e etag; rejeita convidados/eventos especiais", object({ success: { const: true } }), object({ ...version, etag: text(500), confirmCancellation: { const: true } })), parameters: id },
  },
};
