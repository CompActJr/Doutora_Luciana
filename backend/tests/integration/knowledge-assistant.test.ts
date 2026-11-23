import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import type { AssistantSettingsInput, KnowledgeEntryInput } from "@dra/contracts";
import { createApp } from "../../src/app.js";
import { createAuth } from "../../src/modules/auth/auth.js";
import { readEnvironment } from "../../src/config/env.js";
import { createDatabase } from "../../src/plugins/database.js";
import { createUser } from "../../src/modules/users/service.js";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("Execute pnpm run test:integration na raiz para usar um banco temporário.");

test("conhecimento e assistente com PostgreSQL e sessões reais", async (t) => {
  assert.match(new URL(databaseURL).pathname, /^\/dra_auth_test_[a-z0-9_]+$/);
  const database = createDatabase(databaseURL);
  const env = readEnvironment({ DATABASE_URL: databaseURL, NODE_ENV: "test", BETTER_AUTH_SECRET: randomBytes(32).toString("hex") });
  const services = { auth: createAuth(database, env), database, env, resetEmailEnabled: false };
  const makeApp = () => createApp({ logger: false, checkDatabase: async () => {}, authServices: services });
  const app = makeApp();
  t.after(async () => { await app.close(); await database.$disconnect(); });
  const password = "Senha-ficticia-de-conhecimento-2026!";
  const admin = await createUser(database, { name: "Admin conhecimento", email: "knowledge-admin@example.invalid", password, role: "admin" });
  const editor = await createUser(database, { name: "Equipe conhecimento", email: "knowledge-editor@example.invalid", password, role: "editor" });
  async function login(email: string, ip: string) {
    const result = await app.inject({ method: "POST", url: "/api/v1/auth/sign-in/email", payload: { email, password }, headers: { origin: env.APP_ORIGIN }, remoteAddress: ip });
    assert.equal(result.statusCode, 200);
    const raw = result.headers["set-cookie"];
    return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((cookie) => cookie.split(";")[0]).join("; ");
  }
  const adminCookie = await login(admin.email, "198.51.100.180");
  const editorCookie = await login(editor.email, "198.51.100.181");
  const request = (method: "GET" | "POST" | "PATCH" | "PUT", path: string, payload?: object, cookie = editorCookie, origin = env.APP_ORIGIN) =>
    app.inject({ method, url: `/api/v1${path}`, headers: { origin, cookie }, ...(payload ? { payload } : {}) });
  const information: KnowledgeEntryInput = { title: "Informação fictícia", category: "Clínica", content: "Conteúdo exclusivamente de teste.", reviewStatus: "reviewed" };
  const settings: AssistantSettingsInput = { displayName: "Assistente de teste", introduction: "Apresentação fictícia.", tone: "Claro e acolhedor.", boundaries: "Encaminhar dúvidas específicas à equipe.", handoffTriggers: ["Solicitação de atendimento humano"], handoffMessage: "A equipe poderá ajudar.", schedulingInstructions: "Encaminhar à equipe sem prometer horários." };
  let entryId = "";

  await t.test("rotas exigem sessão; mutações rejeitam origem hostil e corpo sem JSON", async () => {
    for (const [method, path, body] of [
      ["GET", "/knowledge", undefined], ["GET", `/knowledge/${randomUUID()}`, undefined],
      ["POST", "/knowledge", information], ["PATCH", `/knowledge/${randomUUID()}`, { revision: 1, content: "Teste" }],
      ["GET", "/assistant-settings", undefined], ["PUT", "/assistant-settings", { ...settings, revision: 0 }],
    ] as const) assert.equal((await request(method, path, body, "")).statusCode, 401);
    assert.equal((await request("POST", "/knowledge", information, editorCookie, "https://hostil.invalid")).statusCode, 403);
    assert.equal((await request("PUT", "/assistant-settings", { ...settings, revision: 0 }, editorCookie, "https://hostil.invalid")).statusCode, 403);
    for (const [method, path] of [["POST", "/knowledge"], ["PUT", "/assistant-settings"]] as const) {
      assert.equal((await app.inject({ method, url: `/api/v1${path}`, payload: "{}", headers: { origin: env.APP_ORIGIN, cookie: editorCookie, "content-type": "text/plain" } })).statusCode, 415);
    }
  });
  await t.test("editor cadastra conhecimento; busca, filtros e paginação não expõem corpo na listagem", async () => {
    const created = await request("POST", "/knowledge", information);
    assert.equal(created.statusCode, 201); entryId = created.json().entry.id;
    await database.knowledgeEntry.createMany({ data: Array.from({ length: 20 }, (_, index) => ({ title: `Informação adicional ${index}`, category: "Outros", content: "Somente teste" })) });
    const found = await request("GET", "/knowledge?search=FICTÍCIA&category=Cl%C3%ADnica&reviewStatus=reviewed");
    assert.equal(found.statusCode, 200); assert.equal(found.json().total, 1); assert.equal(found.json().items[0].id, entryId);
    assert.ok(!("content" in found.json().items[0]));
    assert.equal((await request("GET", "/knowledge")).json().items.length, 20);
    assert.equal((await request("GET", "/knowledge?page=2")).json().items.length, 1);
    assert.deepEqual((await request("GET", "/knowledge")).json().categories, ["Clínica", "Outros"]);
    const detail = await request("GET", `/knowledge/${entryId}`, undefined, adminCookie);
    assert.equal(detail.json().entry.content, information.content); assert.equal(detail.headers["cache-control"], "no-store");
  });
  await t.test("conhecimento valida campos, IDs, limites e rejeita publicação", async () => {
    for (const invalid of [{ ...information, title: "ab" }, { ...information, title: "x".repeat(121) }, { ...information, category: "" },
      { ...information, content: " " }, { ...information, content: "x".repeat(12001) }, { ...information, reviewStatus: "published" }, { ...information, published: true }]) {
      assert.equal((await request("POST", "/knowledge", invalid)).statusCode, 400);
    }
    assert.equal((await request("PATCH", `/knowledge/${entryId}`, { revision: 1 })).statusCode, 400);
    assert.equal((await request("PATCH", `/knowledge/${entryId}`, { content: "Sem revisão" })).statusCode, 400);
    assert.equal((await request("GET", "/knowledge?state=published")).statusCode, 400);
    assert.equal((await request("GET", "/knowledge?page=0")).statusCode, 400);
    assert.equal((await request("GET", "/knowledge/invalido")).statusCode, 400);
    assert.equal((await request("GET", `/knowledge/${randomUUID()}`)).statusCode, 404);
  });
  await t.test("edição concorrente do conhecimento tem um vencedor; desativar preserva texto e permite reativação", async () => {
    const results = await Promise.all(["Texto da equipe", "Texto da admin"].map((content, index) =>
      request("PATCH", `/knowledge/${entryId}`, { revision: 1, content }, index ? adminCookie : editorCookie)));
    assert.deepEqual(results.map((result) => result.statusCode).sort(), [200, 409]);
    const winner = results.find((result) => result.statusCode === 200)!.json().entry;
    assert.equal(winner.reviewStatus, "draft"); assert.equal(winner.revision, 2);
    const disabled = await request("PATCH", `/knowledge/${entryId}`, { revision: 2, isActive: false });
    assert.equal(disabled.statusCode, 200); assert.equal(disabled.json().entry.content, winner.content);
    assert.equal((await request("GET", "/knowledge?state=inactive&category=Cl%C3%ADnica")).json().total, 1);
    assert.equal((await request("GET", "/knowledge?category=Cl%C3%ADnica")).json().total, 0);
    assert.equal((await request("PATCH", `/knowledge/${entryId}`, { revision: 3, isActive: true })).statusCode, 200);
  });
  await t.test("consultar assistente vazia não cria dados; criação concorrente mantém configuração única", async () => {
    assert.equal((await request("GET", "/assistant-settings")).json().settings, null);
    assert.equal(await database.assistantSettings.count(), 0);
    const results = await Promise.all([editorCookie, adminCookie].map((cookie) => request("PUT", "/assistant-settings", { ...settings, revision: 0 }, cookie)));
    assert.deepEqual(results.map((result) => result.statusCode).sort(), [200, 409]);
    assert.equal(await database.assistantSettings.count(), 1);
    assert.equal((await request("GET", "/assistant-settings")).json().settings.id, "clinic");
  });
  await t.test("assistente valida todos os limites e não aceita ID ou publicação enviados pelo navegador", async () => {
    for (const invalid of [{ ...settings, displayName: "" }, { ...settings, displayName: "x".repeat(81) }, { ...settings, introduction: " " },
      { ...settings, tone: "x".repeat(2001) }, { ...settings, boundaries: "x".repeat(4001) }, { ...settings, handoffTriggers: [] },
      { ...settings, handoffTriggers: Array(21).fill("Teste") }, { ...settings, handoffTriggers: ["x".repeat(301)] },
      { ...settings, handoffMessage: "x".repeat(3001) }, { ...settings, schedulingInstructions: "" }, { ...settings, id: "outra" }, { ...settings, published: true }]) {
      assert.equal((await request("PUT", "/assistant-settings", { ...invalid, revision: 1 })).statusCode, 400);
    }
    assert.equal((await request("PUT", "/assistant-settings", { ...settings, revision: -1 })).statusCode, 400);
    assert.equal((await request("PUT", "/assistant-settings", { ...settings, revision: 1.5 })).statusCode, 400);
  });
  await t.test("assistente rejeita revisão antiga e persiste após reabrir aplicação", async () => {
    const results = await Promise.all(["Tom da equipe", "Tom da administradora"].map((tone, index) =>
      request("PUT", "/assistant-settings", { ...settings, tone, revision: 1 }, index ? adminCookie : editorCookie)));
    assert.deepEqual(results.map((result) => result.statusCode).sort(), [200, 409]);
    const current = (await request("GET", "/assistant-settings")).json().settings;
    assert.equal(current.revision, 2); assert.equal((await request("PUT", "/assistant-settings", { ...settings, revision: 1 })).statusCode, 409);
    const recreated = makeApp();
    try {
      const result = await recreated.inject({ url: "/api/v1/assistant-settings", headers: { cookie: editorCookie } });
      assert.equal(result.statusCode, 200); assert.deepEqual(result.json().settings, current);
      const knowledge = await recreated.inject({ url: `/api/v1/knowledge/${entryId}`, headers: { cookie: editorCookie } });
      assert.equal(knowledge.statusCode, 200); assert.equal(knowledge.json().entry.revision, 4);
    } finally { await recreated.close(); }
  });
  await t.test("não publica nem chama IA; bloquear editor encerra acesso aos dois módulos", async () => {
    for (const cookie of [adminCookie, editorCookie]) {
      assert.equal((await request("POST", "/assistant-settings/publish", {}, cookie)).statusCode, 404);
      assert.equal((await request("POST", `/knowledge/${entryId}/publish`, {}, cookie)).statusCode, 404);
    }
    assert.equal((await app.inject({ url: "/api/v1/knowledge", headers: { authorization: "Bearer token-ficticio" } })).statusCode, 401);
    assert.equal((await request("PATCH", `/users/${editor.id}`, { disabled: true }, adminCookie)).statusCode, 200);
    assert.equal((await request("GET", "/knowledge")).statusCode, 401);
    assert.equal((await request("POST", "/knowledge", information)).statusCode, 401);
    assert.equal((await request("GET", "/assistant-settings")).statusCode, 401);
    assert.equal((await request("PUT", "/assistant-settings", { ...settings, revision: 2 })).statusCode, 401);
    assert.equal((await request("GET", "/assistant-settings", undefined, adminCookie)).statusCode, 200);
  });
});
