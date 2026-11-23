import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import type { ContentDraftResponse, ContentVersion, SimulationResponse } from "@dra/contracts";
import { createApp } from "../../src/app.js";
import { createAuth } from "../../src/modules/auth/auth.js";
import { readEnvironment } from "../../src/config/env.js";
import { createDatabase } from "../../src/plugins/database.js";
import { createUser, AccessError } from "../../src/modules/users/service.js";
import { createAiProvider } from "../../src/modules/ai/provider.js";
import { fingerprint } from "../../src/modules/content/versions.js";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("Execute pnpm run test:integration na raiz.");

test("etapa 2: versões, isolamento, simulador e conexão IA", async (t) => {
  assert.match(new URL(databaseURL).pathname, /^\/dra_auth_test_[a-z0-9_]+$/);
  const database = createDatabase(databaseURL);
  const env = readEnvironment({ DATABASE_URL: databaseURL, NODE_ENV: "test", BETTER_AUTH_SECRET: randomBytes(32).toString("hex") });
  let calls = 0;
  let fail = false;
  let bad = false;
  let delay: Promise<void> | undefined;
  const provider = { model: "fixture-model", async generate(input: { input: string; variations?: boolean }) { calls++; if (delay) await delay; if (fail) throw new AccessError(503, "Falha fictícia."); if (input.variations) return bad ? "invalid" : JSON.stringify({ suggestions: ["Variação fictícia sem novos fatos."] }); assert.match(input.input, /conversation/); return "Resposta de IA fictícia para teste."; } };
  const services = { auth: createAuth(database, env), database, env, resetEmailEnabled: false, aiProvider: provider };
  const app = createApp({ logger: false, checkDatabase: async () => {}, authServices: services });
  const noAi = createApp({ logger: false, checkDatabase: async () => {}, authServices: { ...services, aiProvider: undefined } });
  t.after(async () => {
    await app.close(); await noAi.close();
    await database.responseTemplate.deleteMany({ where: { title: "Primeira consulta fictícia" } });
    await database.knowledgeEntry.deleteMany({ where: { title: "Informação fictícia da clínica" } });
    await database.assistantSettings.deleteMany({ where: { displayName: "Assistente fictícia" } });
    await database.$disconnect();
  });
  const password = randomBytes(24).toString("hex");
  const admin = await createUser(database, { name: "Admin etapas", email: "stage2-admin@example.invalid", password, role: "admin" });
  const editor = await createUser(database, { name: "Editor etapas", email: "stage2-editor@example.invalid", password, role: "editor" });
  async function login(email: string, ip: string) {
    const result = await app.inject({ method: "POST", url: "/api/v1/auth/sign-in/email", payload: { email, password }, headers: { origin: env.APP_ORIGIN }, remoteAddress: ip });
    assert.equal(result.statusCode, 200);
    const raw = result.headers["set-cookie"];
    return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((cookie) => cookie.split(";")[0]).join("; ");
  }
  const adminCookie = await login(admin.email, "198.51.100.150");
  const editorCookie = await login(editor.email, "198.51.100.151");
  const request = (method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, payload?: object, cookie = adminCookie) => app.inject({ method, url: `/api/v1${path}`, headers: { origin: env.APP_ORIGIN, cookie }, ...(payload ? { payload } : {}) });
  let responseId = "";
  let knowledgeId = "";
  let firstVersion: ContentVersion;
  let restored: ContentVersion;
  let demo: SimulationResponse["simulation"];
  let ai: SimulationResponse["simulation"];
  const draft = async () => (await request("GET", "/content/draft")).json<ContentDraftResponse>();
  const activation = async (note = "Publicação interna fictícia") => { const view = await draft(); return { fingerprint: view.fingerprint, expectedActiveVersionId: view.activeVersionId, note, confirmInternalOnly: true }; };

  await t.test("autenticação, origem e permissão admin são exigidas nas novas rotas", async () => {
    for (const path of ["/content/draft", "/content/versions", "/ai/status", "/simulations"]) assert.equal((await request("GET", path, undefined, "")).statusCode, 401);
    assert.equal((await request("POST", "/content/versions", {}, editorCookie)).statusCode, 403);
    assert.equal((await request("POST", `/content/versions/${randomUUID()}/restore`, {}, editorCookie)).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: "/api/v1/simulations", headers: { cookie: adminCookie, origin: "https://hostil.invalid" }, payload: {} })).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: "/api/v1/content/versions", headers: { cookie: adminCookie, origin: env.APP_ORIGIN, "content-type": "text/plain" }, payload: "{}" })).statusCode, 415);
  });
  await t.test("OpenAPI autenticada documenta contratos, parâmetros e todas as referências locais", async () => {
    assert.equal((await request("GET", "/openapi.json", undefined, "")).statusCode, 401);
    const spec = (await request("GET", "/openapi.json", undefined, editorCookie)).json();
    assert.equal(spec.openapi, "3.1.0"); assert.equal(spec.servers[0].url, "/api/v1");
    const walk = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (key === "$ref") { assert.equal(typeof child, "string"); const name = String(child).split("/").at(-1)!; assert.ok(spec.components.schemas[name], `Referência ausente: ${name}`); }
        else walk(child);
      }
    };
    walk(spec);
    assert.ok(spec.paths["/content/versions"].post.requestBody);
    assert.ok(spec.paths["/simulations/{id}/messages"].post.requestBody);
    assert.equal(JSON.stringify(spec).includes("fixture-key"), false);
  });
  await t.test("ativação exige assistente e conteúdo revisado; prévia não altera o banco", async () => {
    assert.equal((await request("POST", "/content/versions", await activation())).statusCode, 409);
    await database.responseTemplate.updateMany({ data: { isActive: false } });
    await database.knowledgeEntry.updateMany({ data: { isActive: false } });
    const result = await request("POST", "/responses", { title: "Primeira consulta fictícia", category: "Teste", questionExamples: ["Como funciona a primeira consulta?"], answer: "A consulta fictícia começa com uma conversa.", variations: [], reviewStatus: "needs_review" });
    responseId = result.json().response.id;
    knowledgeId = (await request("POST", "/knowledge", { title: "Informação fictícia da clínica", category: "Teste", content: "Somente dados fictícios para teste.", reviewStatus: "reviewed" })).json().entry.id;
    await database.assistantSettings.upsert({ where: { id: "clinic" }, create: { id: "clinic", displayName: "Assistente fictícia", introduction: "Olá!", tone: "Acolhedor", boundaries: "Sem diagnóstico.", handoffTriggers: ["quero ajuda humana"], handoffMessage: "Procure a equipe fictícia.", schedulingInstructions: "Sem prometer horários." }, update: {} });
    const before = await database.contentVersion.count();
    const view = await draft(); assert.ok(view.issues.length); assert.equal(await database.contentVersion.count(), before);
    assert.equal((await request("POST", "/content/versions", await activation())).statusCode, 409);
    await request("PATCH", `/responses/${responseId}`, { revision: 1, reviewStatus: "reviewed" });
    const invalid = { ...await activation(), confirmInternalOnly: false };
    assert.equal((await request("POST", "/content/versions", invalid)).statusCode, 400);
  });
  await t.test("prévia obsoleta rejeitada; versão contém configuração completa e é imutável", async () => {
    const stale = await activation();
    await request("PATCH", `/knowledge/${knowledgeId}`, { revision: 1, content: "Informação atualizada fictícia.", reviewStatus: "reviewed" });
    assert.equal((await request("POST", "/content/versions", stale)).statusCode, 409);
    const result = await request("POST", "/content/versions", await activation()); assert.equal(result.statusCode, 201);
    firstVersion = result.json().version;
    assert.ok(firstVersion.snapshot.assistant); assert.ok(firstVersion.snapshot.responses.some((item) => item.id === responseId));
    assert.equal(fingerprint(firstVersion.snapshot), firstVersion.fingerprint);
    await assert.rejects(database.contentVersion.update({ where: { id: firstVersion.id }, data: { note: "Proibido" } }));
    await assert.rejects(database.contentVersion.delete({ where: { id: firstVersion.id } }));
    assert.equal((await request("GET", `/content/versions/${firstVersion.id}`, undefined, editorCookie)).statusCode, 200);
  });
  await t.test("rascunhos não alteram versão; restauração cria outra versão sem sobrescrever rascunhos", async () => {
    await request("PATCH", `/responses/${responseId}`, { revision: 2, answer: "Rascunho novo ainda não publicado." });
    const unchanged = (await request("GET", `/content/versions/${firstVersion.id}`)).json().version;
    assert.deepEqual(unchanged, firstVersion);
    const result = await request("POST", `/content/versions/${firstVersion.id}/restore`, { expectedActiveVersionId: firstVersion.id, note: "Restauração fictícia", confirmInternalOnly: true });
    assert.equal(result.statusCode, 201); restored = result.json().version;
    assert.notEqual(restored.id, firstVersion.id); assert.equal(restored.restoredFrom, firstVersion.id); assert.deepEqual(restored.snapshot, firstVersion.snapshot);
    assert.equal((await request("GET", `/responses/${responseId}`)).json().response.answer, "Rascunho novo ainda não publicado.");
    assert.equal((await request("POST", `/content/versions/${firstVersion.id}/restore`, { expectedActiveVersionId: firstVersion.id, note: "Restauração obsoleta", confirmInternalOnly: true })).statusCode, 409);
    assert.equal((await request("GET", "/content/versions")).json().activeVersionId, restored.id);
    assert.equal((await request("GET", "/content/versions?page=0")).statusCode, 400);
  });
  await t.test("ativação concorrente cria uma só versão; revisão em falta continua bloqueada", async () => {
    assert.equal((await request("POST", "/content/versions", await activation())).statusCode, 409);
    await request("PATCH", `/responses/${responseId}`, { revision: 3, reviewStatus: "reviewed" });
    const input = await activation();
    const results = await Promise.all([request("POST", "/content/versions", input), request("POST", "/content/versions", input)]);
    assert.deepEqual(results.map((item) => item.statusCode).sort(), [201, 409]);
  });
  await t.test("demo usa cópia fixa, contexto anterior, encaminhamento e idempotência", async () => {
    const created = await request("POST", "/simulations", { mode: "demo", versionId: firstVersion.id }, editorCookie); assert.equal(created.statusCode, 201); demo = created.json().simulation;
    assert.equal(demo.fingerprint, firstVersion.fingerprint); assert.ok(!("snapshot" in demo)); assert.ok(!("processingToken" in demo));
    const id = randomUUID(); const input = { content: "Como funciona a primeira consulta?", revision: demo.revision, requestId: id };
    const sent = await request("POST", `/simulations/${demo.id}/messages`, input, editorCookie); assert.equal(sent.statusCode, 200); demo = sent.json().simulation;
    assert.equal(demo.messages[1].content, firstVersion.snapshot.responses.find((item) => item.id === responseId)!.answer);
    assert.equal(demo.messages[1].sources?.[0].id, responseId);
    const repeat = await request("POST", `/simulations/${demo.id}/messages`, input, editorCookie); assert.equal(repeat.json().simulation.messages.length, 2);
    const next = await request("POST", `/simulations/${demo.id}/messages`, { content: "Sim", revision: demo.revision, requestId: randomUUID() }, editorCookie);
    demo = next.json().simulation; assert.equal(demo.messages[3].content, demo.messages[1].content);
    demo = (await request("POST", `/simulations/${demo.id}/messages`, { content: "quero ajuda humana", revision: demo.revision, requestId: randomUUID() }, editorCookie)).json().simulation;
    assert.equal(demo.messages.at(-1)?.content, firstVersion.snapshot.assistant!.handoffMessage); assert.equal(calls, 0);
  });
  await t.test("conversas privadas por usuário, limites, revisão e remoção", async () => {
    assert.equal((await request("GET", `/simulations/${demo.id}`)).statusCode, 404);
    assert.ok(!(await request("GET", "/simulations")).json().items.some((item: { id: string }) => item.id === demo.id));
    assert.equal((await request("POST", `/simulations/${demo.id}/messages`, { content: "Oi", revision: 1, requestId: randomUUID() }, editorCookie)).statusCode, 409);
    assert.equal((await request("POST", `/simulations/${demo.id}/messages`, { content: "x".repeat(2001), revision: demo.revision, requestId: randomUUID() }, editorCookie)).statusCode, 400);
    const removable = (await request("POST", "/simulations", { mode: "demo", versionId: null })).json().simulation;
    assert.equal((await request("DELETE", `/simulations/${removable.id}`, {})).statusCode, 200);
    assert.equal((await request("GET", `/simulations/${removable.id}`)).statusCode, 404);
  });
  await t.test("OpenAI ausente retorna indisponível, sem fallback silencioso e sem publicação WhatsApp", async () => {
    const status = await noAi.inject({ url: "/api/v1/ai/status", headers: { cookie: adminCookie } }); assert.equal(status.json().available, false); assert.equal(status.json().whatsappEnabled, false);
    assert.equal((await noAi.inject({ method: "POST", url: "/api/v1/simulations", headers: { cookie: adminCookie, origin: env.APP_ORIGIN }, payload: { mode: "openai", versionId: null } })).statusCode, 503);
    assert.equal((await noAi.inject({ method: "POST", url: `/api/v1/responses/${responseId}/variations`, headers: { cookie: adminCookie, origin: env.APP_ORIGIN }, payload: { revision: 4 } })).statusCode, 503);
    for (const path of ["/publish", "/whatsapp/publish", "/content/publish"]) assert.equal((await request("POST", path, {})).statusCode, 404);
  });
  await t.test("IA injetada: falha preserva conversa; concorrência não duplica chamadas", async () => {
    ai = (await request("POST", "/simulations", { mode: "openai", versionId: firstVersion.id })).json().simulation;
    fail = true;
    const input = { content: "Como funciona a consulta?", revision: ai.revision, requestId: randomUUID() };
    assert.equal((await request("POST", `/simulations/${ai.id}/messages`, input)).statusCode, 503);
    assert.equal((await request("GET", `/simulations/${ai.id}`)).json().simulation.messages.length, 0);
    fail = false;
    let release!: () => void; delay = new Promise<void>((resolve) => { release = resolve; });
    const before = calls; const active = request("POST", `/simulations/${ai.id}/messages`, input);
    while (calls === before) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal((await request("POST", `/simulations/${ai.id}/messages`, input)).statusCode, 409);
    release(); delay = undefined;
    const result = await active; assert.equal(result.statusCode, 200); ai = result.json().simulation;
    assert.equal(ai.messages.length, 2); assert.equal(calls, before + 1);
    assert.equal((await request("POST", `/simulations/${ai.id}/messages`, input)).statusCode, 200); assert.equal(calls, before + 1);
  });
  await t.test("variações são sugestões sem efeitos colaterais, validam revisão e saída; quota persistida", async () => {
    const source = await database.responseTemplate.findUniqueOrThrow({ where: { id: responseId } });
    assert.equal((await request("POST", `/responses/${responseId}/variations`, { revision: source.revision - 1 })).statusCode, 409);
    const suggestion = await request("POST", `/responses/${responseId}/variations`, { revision: source.revision }); assert.equal(suggestion.statusCode, 200); assert.equal(suggestion.json().suggestions.length, 1);
    assert.deepEqual(await database.responseTemplate.findUniqueOrThrow({ where: { id: responseId } }), source);
    bad = true; assert.equal((await request("POST", `/responses/${responseId}/variations`, { revision: source.revision })).statusCode, 503); bad = false;
    await database.aiRequestWindow.update({ where: { userId: admin.id }, data: { count: 10, startedAt: new Date() } });
    const before = calls; assert.equal((await request("POST", `/responses/${responseId}/variations`, { revision: source.revision })).statusCode, 429); assert.equal(calls, before);
    await database.aiRequestWindow.update({ where: { userId: admin.id }, data: { startedAt: new Date(Date.now() - 61_000) } });
    assert.equal((await request("POST", `/responses/${responseId}/variations`, { revision: source.revision })).statusCode, 200);
  });
  await t.test("adaptador HTTP só chama Responses oficial sem ferramentas ou armazenamento e protege erros", async () => {
    let body: Record<string, unknown> = {};
    const aiEnv = { ...env, OPENAI_API_KEY: "fixture-key-never-real", OPENAI_MODEL: "fixture-model" };
    const provider = createAiProvider(aiEnv, (async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses"); body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Fictício" }] }] }));
    }) as typeof fetch)!;
    assert.equal(await provider.generate({ instructions: "Regra fictícia", input: "Mensagem fictícia" }), "Fictício");
    assert.equal(body.store, false); assert.deepEqual(body.tools, []); assert.equal(body.model, "fixture-model");
    await provider.generate({ instructions: "Variações", input: "Texto", variations: true }); assert.equal((body.text as { format: { type: string } }).format.type, "json_schema");
    const faulty = createAiProvider(aiEnv, (async () => { throw new Error("fixture-key-never-real patient-content"); }) as typeof fetch)!;
    await assert.rejects(faulty.generate({ instructions: "", input: "" }), (e: unknown) => e instanceof AccessError && e.statusCode === 503 && !e.message.includes("fixture-key"));
  });
  await t.test("recriação da aplicação preserva versões e conversas; usuário bloqueado perde acesso", async () => {
    const reopened = createApp({ logger: false, checkDatabase: async () => {}, authServices: services });
    assert.equal((await reopened.inject({ url: `/api/v1/content/versions/${firstVersion.id}`, headers: { cookie: adminCookie } })).json().version.fingerprint, firstVersion.fingerprint);
    assert.equal((await reopened.inject({ url: `/api/v1/simulations/${ai.id}`, headers: { cookie: adminCookie } })).json().simulation.messages.length, 2);
    await reopened.close();
    await database.user.update({ where: { id: editor.id }, data: { disabled: true } });
    assert.equal((await request("GET", "/simulations", undefined, editorCookie)).statusCode, 401);
    assert.equal((await request("GET", "/content/versions", undefined, editorCookie)).statusCode, 401);
  });
});
