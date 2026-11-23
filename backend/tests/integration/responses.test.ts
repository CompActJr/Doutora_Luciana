import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import type { ResponseTemplate, ResponseTemplateInput, ResponseTemplatesResponse } from "@dra/contracts";
import { createApp } from "../../src/app.js";
import { createAuth } from "../../src/modules/auth/auth.js";
import { readEnvironment } from "../../src/config/env.js";
import { createDatabase } from "../../src/plugins/database.js";
import { createUser } from "../../src/modules/users/service.js";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("Execute pnpm run test:integration na raiz para criar um banco isolado.");

test("rascunhos de respostas com PostgreSQL e autenticação reais", async (t) => {
  assert.match(new URL(databaseURL).pathname, /^\/dra_auth_test_[a-z0-9_]+$/);
  const database = createDatabase(databaseURL);
  const env = readEnvironment({ DATABASE_URL: databaseURL, NODE_ENV: "test", BETTER_AUTH_SECRET: randomBytes(32).toString("hex") });
  const services = { auth: createAuth(database, env), database, env, resetEmailEnabled: false };
  const makeApp = () => createApp({ logger: false, checkDatabase: async () => {}, authServices: services });
  const app = makeApp();
  t.after(async () => { await app.close(); await database.$disconnect(); });
  const password = "Senha-ficticia-de-conteudo-2026!";
  const admin = await createUser(database, { name: "Admin conteúdo", email: "content-admin@example.invalid", password, role: "admin" });
  const editor = await createUser(database, { name: "Editor conteúdo", email: "content-editor@example.invalid", password, role: "editor" });
  let address = 60;
  async function login(email: string) {
    const response = await app.inject({ method: "POST", url: "/api/v1/auth/sign-in/email", payload: { email, password },
      headers: { origin: env.APP_ORIGIN }, remoteAddress: `198.51.100.${address++}` });
    assert.equal(response.statusCode, 200, response.body);
    const raw = response.headers["set-cookie"];
    return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((cookie) => cookie.split(";")[0]).join("; ");
  }
  const adminCookie = await login(admin.email);
  const editorCookie = await login(editor.email);
  const request = (method: "GET" | "POST" | "PATCH", path: string, body?: object, cookie = editorCookie, origin = env.APP_ORIGIN) =>
    app.inject({ method, url: `/api/v1${path}`, headers: { cookie, origin }, ...(body ? { payload: body } : {}) });
  const input: ResponseTemplateInput = { title: "Primeira consulta fictícia", category: "Atendimento", answer: "Informação de teste, sem conteúdo clínico real.",
    questionExamples: ["Como funciona a consulta?", "Quero conhecer o atendimento"], variations: ["Texto alternativo de teste."], reviewStatus: "needs_review" };
  let saved: ResponseTemplate;

  await t.test("rejeita acesso anônimo, origem hostil e payload sem JSON em todas as mutações", async () => {
    const id = randomUUID();
    for (const [method, path, body] of [
      ["GET", "/responses", undefined], ["GET", `/responses/${id}`, undefined],
      ["POST", "/responses", input], ["PATCH", `/responses/${id}`, { revision: 1, answer: "Texto" }],
      ["POST", `/responses/${id}/duplicate`, { revision: 1 }],
    ] as const) assert.equal((await request(method, path, body, "")).statusCode, 401);
    assert.equal((await request("POST", "/responses", input, editorCookie, "https://hostil.invalid")).statusCode, 403);
    assert.equal((await request("PATCH", `/responses/${id}`, { revision: 1, answer: "Texto" }, editorCookie, "https://hostil.invalid")).statusCode, 403);
    assert.equal((await request("POST", `/responses/${id}/duplicate`, { revision: 1 }, editorCookie, "https://hostil.invalid")).statusCode, 403);
    const text = await app.inject({ method: "POST", url: "/api/v1/responses", payload: "{}",
      headers: { cookie: editorCookie, origin: env.APP_ORIGIN, "content-type": "text/plain" } });
    assert.equal(text.statusCode, 415);
    assert.equal(await database.responseTemplate.count(), 0);
  });

  await t.test("editor cria conteúdo; admin consulta; reabrir a aplicação mantém dados e sessão", async () => {
    const created = await request("POST", "/responses", input);
    assert.equal(created.statusCode, 201, created.body);
    saved = created.json().response;
    assert.equal(saved.revision, 1);
    assert.equal(saved.isActive, true);
    assert.deepEqual(saved.questionExamples, input.questionExamples);
    assert.equal((await request("GET", `/responses/${saved.id}`, undefined, adminCookie)).statusCode, 200);
    assert.equal((await database.responseTemplate.findUniqueOrThrow({ where: { id: saved.id } })).answer, input.answer);
    const recreated = makeApp();
    try {
      const result = await recreated.inject({ url: `/api/v1/responses/${saved.id}`, headers: { cookie: editorCookie } });
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.json().response, saved);
      assert.equal(result.headers["cache-control"], "no-store");
    } finally { await recreated.close(); }
  });

  await t.test("busca, categorias, revisão, atividade e paginação são aplicadas no banco", async () => {
    await database.responseTemplate.createMany({ data: Array.from({ length: 21 }, (_, index) => ({ title: `Modelo de paginação ${index}`, category: "Outros", answer: "Somente teste" })) });
    const list = (await request("GET", "/responses?state=all")).json<ResponseTemplatesResponse>();
    assert.equal(list.total, 22); assert.equal(list.items.length, 20); assert.equal(list.pageSize, 20);
    const second = (await request("GET", "/responses?state=all&page=2")).json<ResponseTemplatesResponse>();
    assert.equal(second.items.length, 2);
    assert.ok(second.items.every((item) => !list.items.some((first) => first.id === item.id)));
    assert.deepEqual(list.categories, ["Atendimento", "Outros"]);
    const found = (await request("GET", "/responses?search=PRIMEIRA&category=Atendimento&reviewStatus=needs_review")).json<ResponseTemplatesResponse>();
    assert.equal(found.total, 1); assert.equal(found.items[0].id, saved.id);
    assert.equal((await request("GET", "/responses?state=inactive")).json().total, 0);
    assert.equal((await request("GET", "/responses?search=nenhum-resultado")).json().total, 0);
    assert.ok(!("answer" in found.items[0]));
  });

  await t.test("valida limites e campos desconhecidos sem aceitar publicação ou IDs fornecidos", async () => {
    for (const invalid of [
      { ...input, title: " " }, { ...input, title: "a".repeat(121) }, { ...input, answer: " " },
      { ...input, answer: "a".repeat(6001) }, { ...input, category: "" }, { ...input, category: "a".repeat(81) },
      { ...input, questionExamples: Array(21).fill("Pergunta") }, { ...input, questionExamples: ["a".repeat(501)] },
      { ...input, variations: Array(11).fill("Texto") }, { ...input, variations: [""] },
      { ...input, reviewStatus: "published" }, { ...input, published: true }, { ...input, id: randomUUID() },
    ]) assert.equal((await request("POST", "/responses", invalid)).statusCode, 400);
    assert.equal((await request("PATCH", `/responses/${saved.id}`, { revision: 1 })).statusCode, 400);
    assert.equal((await request("PATCH", `/responses/${saved.id}`, { answer: "Sem revisão" })).statusCode, 400);
    assert.equal((await request("GET", "/responses?state=published")).statusCode, 400);
    assert.equal((await request("GET", "/responses?page=0")).statusCode, 400);
    assert.equal((await request("GET", "/responses/id-invalido")).statusCode, 400);
    assert.equal((await request("GET", `/responses/${randomUUID()}`)).statusCode, 404);
    assert.equal((await request("PATCH", `/responses/${randomUUID()}`, { revision: 1, answer: "Teste" })).statusCode, 404);
  });

  await t.test("revisão atômica impede perda de edição concorrente e alteração implícita invalida revisão", async () => {
    const reviewed = await request("PATCH", `/responses/${saved.id}`, { revision: saved.revision, reviewStatus: "reviewed" }, adminCookie);
    assert.equal(reviewed.statusCode, 200); saved = reviewed.json().response;
    const results = await Promise.all(["Edição da equipe", "Edição da administradora"].map((answer, index) =>
      request("PATCH", `/responses/${saved.id}`, { revision: saved.revision, answer }, index ? adminCookie : editorCookie)));
    assert.deepEqual(results.map((result) => result.statusCode).sort(), [200, 409]);
    const winning = results.find((result) => result.statusCode === 200)!.json().response as ResponseTemplate;
    assert.equal(winning.revision, saved.revision + 1); assert.equal(winning.reviewStatus, "draft");
    const current = (await request("GET", `/responses/${saved.id}`)).json().response;
    assert.deepEqual(current, winning); saved = winning;
  });

  await t.test("desativar preserva conteúdo; duplicar cria rascunho independente; reativar funciona", async () => {
    const inactive = await request("PATCH", `/responses/${saved.id}`, { revision: saved.revision, isActive: false });
    assert.equal(inactive.statusCode, 200); saved = inactive.json().response;
    assert.equal(saved.isActive, false); assert.equal(saved.answer.startsWith("Edição"), true);
    assert.equal((await request("GET", "/responses?category=Atendimento")).json().total, 0);
    assert.equal((await request("GET", "/responses?category=Atendimento&state=inactive")).json().total, 1);
    assert.equal((await request("POST", `/responses/${saved.id}/duplicate`, { revision: saved.revision - 1 })).statusCode, 409);
    const duplicate = await request("POST", `/responses/${saved.id}/duplicate`, { revision: saved.revision });
    assert.equal(duplicate.statusCode, 201); const copied = duplicate.json().response as ResponseTemplate;
    assert.notEqual(copied.id, saved.id); assert.equal(copied.reviewStatus, "draft"); assert.equal(copied.isActive, true); assert.equal(copied.revision, 1);
    assert.deepEqual(copied.variations, saved.variations); assert.match(copied.title, /\(cópia\)$/);
    await request("PATCH", `/responses/${copied.id}`, { revision: 1, answer: "Texto independente" });
    assert.equal((await request("GET", `/responses/${saved.id}`)).json().response.answer, saved.answer);
    const reactivated = await request("PATCH", `/responses/${saved.id}`, { revision: saved.revision, isActive: true });
    assert.equal(reactivated.statusCode, 200); saved = reactivated.json().response; assert.equal(saved.isActive, true);
  });

  await t.test("não há publicação, simulação real ou acesso por token de serviço; bloqueio revoga acesso ao conteúdo", async () => {
    for (const cookie of [adminCookie, editorCookie]) {
      assert.equal((await request("POST", `/responses/${saved.id}/publish`, {}, cookie)).statusCode, 404);
      assert.equal((await request("POST", "/responses/publish", {}, cookie)).statusCode, 404);
    }
    assert.equal((await app.inject({ url: "/api/v1/responses", headers: { authorization: "Bearer token-ficticio" } })).statusCode, 401);
    const blocked = await request("PATCH", `/users/${editor.id}`, { disabled: true }, adminCookie);
    assert.equal(blocked.statusCode, 200);
    assert.equal((await request("GET", "/responses")).statusCode, 401);
    assert.equal((await request("POST", "/responses", input)).statusCode, 401);
    assert.equal((await request("PATCH", `/responses/${saved.id}`, { revision: saved.revision, answer: "Não permitido" })).statusCode, 401);
    assert.equal((await request("POST", `/responses/${saved.id}/duplicate`, { revision: saved.revision })).statusCode, 401);
    assert.equal((await request("GET", `/responses/${saved.id}`, undefined, adminCookie)).statusCode, 200);
  });
});
