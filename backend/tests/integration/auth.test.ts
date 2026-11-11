import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { createApp } from "../../src/app.js";
import { readEnvironment } from "../../src/config/env.js";
import { createDatabase } from "../../src/plugins/database.js";
import { createAuth } from "../../src/modules/auth/auth.js";
import { createUser } from "../../src/modules/users/service.js";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("Execute pnpm run test:integration na raiz para criar um banco isolado.");

test("autenticação com PostgreSQL isolado", { skip: !databaseURL }, async (t) => {
  assert.match(new URL(databaseURL!).pathname, /^\/dra_auth_test_[a-z0-9_]+$/);
  const database = createDatabase(databaseURL!);
  const env = readEnvironment({ DATABASE_URL: databaseURL, NODE_ENV: "test", BETTER_AUTH_SECRET: randomBytes(32).toString("hex") });
  const emails: { email: string; url: string }[] = [];
  const sendMail = async (message: { email: string; url: string }) => { emails.push(message); };
  const auth = createAuth(database, env, sendMail);
  const app = createApp({ logger: false, checkDatabase: async () => { await database.$queryRaw`SELECT 1`; },
    authServices: { auth, database, env, resetEmailEnabled: true } });
  t.after(async () => { await app.close(); await database.$disconnect(); });
  const password = "Senha-local-de-teste-2026!";
  const admin = await createUser(database, { name: "Admin de teste", email: "admin@example.invalid", password, role: "admin" }, true);
  const editor = await createUser(database, { name: "Equipe de teste", email: "editor@example.invalid", password, role: "editor" });
  let address = 1;
  const post = (path: string, body: object, cookie = "", extra: Record<string, string> = {}, ip?: string) => app.inject({
    method: "POST", url: path, payload: body, remoteAddress: ip ?? `198.51.100.${address++}`,
    headers: { origin: env.APP_ORIGIN, "content-type": "application/json", cookie, ...extra },
  });
  const get = (path: string, cookie = "") => app.inject({ url: path, headers: { cookie } });
  function cookie(response: Awaited<ReturnType<typeof post>>) {
    const raw = response.headers["set-cookie"];
    return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((value) => value.split(";")[0]).join("; ");
  }
  async function login(email: string, pass = password) {
    const response = await post("/api/v1/auth/sign-in/email", { email, password: pass });
    assert.equal(response.statusCode, 200, response.body);
    return cookie(response);
  }
  const adminCookie = await login(admin.email);
  let editorCookie = await login(editor.email);

  await t.test("não permite cadastro público, nem entrada com senha errada", async () => {
    const signup = await post("/api/v1/auth/sign-up/email", { name: "Invasor", email: "intruso@example.invalid", password, role: "admin" });
    assert.equal(signup.statusCode, 404);
    const bad = await post("/api/v1/auth/sign-in/email", { email: editor.email, password: "senha-incorreta" });
    assert.equal(bad.statusCode, 401);
    assert.equal(await database.user.count(), 2);
    assert.notEqual((await database.account.findFirstOrThrow({ where: { userId: editor.id } })).password, password);
  });
  await t.test("cookies protegidos, sessão persistida e permissões na API", async () => {
    const signedIn = await post("/api/v1/auth/sign-in/email", { email: editor.email, password });
    assert.match(String(signedIn.headers["set-cookie"]), /HttpOnly/i);
    assert.match(String(signedIn.headers["set-cookie"]), /SameSite=Lax/i);
    assert.equal((await get("/api/v1/me")).statusCode, 401);
    assert.equal((await get("/api/v1/users", editorCookie)).statusCode, 403);
    const users = await get("/api/v1/users", adminCookie);
    assert.equal(users.statusCode, 200);
    assert.ok(!/password|session_token|accessToken/.test(users.body));
    const recreated = createApp({ logger: false, checkDatabase: async () => {}, authServices: {
      auth: createAuth(database, env, sendMail), database, env, resetEmailEnabled: true,
    } });
    try { assert.equal((await recreated.inject({ url: "/api/v1/me", headers: { cookie: editorCookie } })).statusCode, 200); }
    finally { await recreated.close(); }
  });
  await t.test("apenas admin cria usuários; valida dados e e-mail duplicado", async () => {
    assert.equal((await post("/api/v1/users", { name: "Pessoa", email: "novo@example.invalid", password }, editorCookie)).statusCode, 403);
    assert.equal((await post("/api/v1/users", { name: "Pessoa", email: "novo@example.invalid", password: "curta" }, adminCookie)).statusCode, 400);
    assert.equal((await post("/api/v1/users", { name: "Pessoa", email: editor.email, password }, adminCookie)).statusCode, 409);
    const created = await post("/api/v1/users", { name: "Outra pessoa", email: "novo@example.invalid", password }, adminCookie);
    assert.equal(created.statusCode, 201);
    assert.equal(created.json().user.role, "editor");
    await assert.rejects(createUser(database, { name: "Segundo bootstrap", email: "bootstrap@example.invalid", password, role: "admin" }, true));
  });
  await t.test("bloqueia alterações de estado vindas de outra origem", async () => {
    const rejected = await post("/api/v1/auth/sign-out", {}, editorCookie, { origin: "https://hostil.invalid" });
    assert.equal(rejected.statusCode, 403);
    assert.equal((await get("/api/v1/me", editorCookie)).statusCode, 200);
    const reset = await post("/api/v1/auth/request-password-reset", { email: editor.email, redirectTo: "https://hostil.invalid" });
    assert.equal(reset.statusCode, 403);
  });
  await t.test("revogar sessões encerra o acesso imediatamente", async () => {
    assert.equal((await post(`/api/v1/users/${editor.id}/revoke-sessions`, {}, adminCookie)).statusCode, 200);
    assert.equal((await get("/api/v1/me", editorCookie)).statusCode, 401);
    editorCookie = await login(editor.email);
  });
  await t.test("trocar perfil revoga sessões; não permite autoelevação ou remover a própria admin", async () => {
    const elevate = await app.inject({ method: "PATCH", url: `/api/v1/users/${editor.id}`, payload: { role: "admin" }, headers: { origin: env.APP_ORIGIN, cookie: editorCookie } });
    assert.equal(elevate.statusCode, 403);
    const self = await app.inject({ method: "PATCH", url: `/api/v1/users/${admin.id}`, payload: { role: "editor" }, headers: { origin: env.APP_ORIGIN, cookie: adminCookie } });
    assert.equal(self.statusCode, 409);
    const change = await app.inject({ method: "PATCH", url: `/api/v1/users/${editor.id}`, payload: { role: "admin" }, headers: { origin: env.APP_ORIGIN, cookie: adminCookie } });
    assert.equal(change.statusCode, 200);
    assert.equal((await get("/api/v1/me", editorCookie)).statusCode, 401);
    editorCookie = await login(editor.email);
    assert.equal((await get("/api/v1/users", editorCookie)).statusCode, 200);
  });
  await t.test("bloquear usuário revoga sessões e impede novo login", async () => {
    const blocked = await app.inject({ method: "PATCH", url: `/api/v1/users/${editor.id}`, payload: { disabled: true }, headers: { origin: env.APP_ORIGIN, cookie: adminCookie } });
    assert.equal(blocked.statusCode, 200);
    assert.equal((await get("/api/v1/me", editorCookie)).statusCode, 401);
    assert.notEqual((await post("/api/v1/auth/sign-in/email", { email: editor.email, password })).statusCode, 200);
  });
  await t.test("recupera senha com token único e revoga as sessões anteriores", async () => {
    const previous = await login("novo@example.invalid");
    const known = await post("/api/v1/auth/request-password-reset", { email: "novo@example.invalid", redirectTo: `${env.APP_ORIGIN}/redefinir-senha` });
    const unknown = await post("/api/v1/auth/request-password-reset", { email: "ausente@example.invalid", redirectTo: `${env.APP_ORIGIN}/redefinir-senha` });
    assert.equal(known.statusCode, 200);
    assert.equal(unknown.statusCode, 200);
    assert.equal(known.body, unknown.body);
    assert.equal(emails.length, 1);
    const link = new URL(emails[0].url);
    const redirect = await get(`${link.pathname}${link.search}`);
    assert.equal(redirect.statusCode, 302);
    const token = new URL(String(redirect.headers.location)).searchParams.get("token");
    assert.ok(token);
    const newPassword = "Nova-senha-local-de-teste-2026!";
    const changed = await post("/api/v1/auth/reset-password", { token, newPassword });
    assert.equal(changed.statusCode, 200, changed.body);
    assert.equal((await get("/api/v1/me", previous)).statusCode, 401);
    assert.equal((await post("/api/v1/auth/reset-password", { token, newPassword })).statusCode, 400);
    await login("novo@example.invalid", newPassword);
    assert.equal((await post("/api/v1/auth/sign-in/email", { email: "novo@example.invalid", password })).statusCode, 401);
    await post("/api/v1/auth/request-password-reset", { email: "novo@example.invalid", redirectTo: `${env.APP_ORIGIN}/redefinir-senha` });
    const expiredToken = new URL(emails.at(-1)!.url).pathname.split("/").at(-1);
    await database.verification.updateMany({ data: { expiresAt: new Date(0) } });
    assert.equal((await post("/api/v1/auth/reset-password", { token: expiredToken, newPassword })).statusCode, 400);
  });
  await t.test("limita tentativas por IP mesmo com headers falsificados", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const failed = await post("/api/v1/auth/sign-in/email", { email: "ausente@example.invalid", password }, "", {
        "x-forwarded-for": `203.0.113.${attempt + 1}`, "x-dra-client-ip": `203.0.113.${attempt + 10}`,
      }, "198.51.100.200");
      assert.equal(failed.statusCode, 401);
    }
    const blocked = await post("/api/v1/auth/sign-in/email", { email: "ausente@example.invalid", password }, "", {}, "198.51.100.200");
    assert.equal(blocked.statusCode, 429);
    assert.ok(await database.rateLimit.count() > 0);
  });
  await t.test("produção usa cookies Secure e origem HTTPS", async () => {
    const production = { ...env, NODE_ENV: "production" as const, APP_ORIGIN: "https://painel.example.invalid" };
    const prod = createApp({ logger: false, checkDatabase: async () => {}, authServices: {
      auth: createAuth(database, production, sendMail), database, env: production, resetEmailEnabled: true,
    } });
    try {
      const response = await prod.inject({ method: "POST", url: "/api/v1/auth/sign-in/email", payload: { email: admin.email, password },
        headers: { origin: production.APP_ORIGIN }, remoteAddress: "198.51.100.250" });
      assert.equal(response.statusCode, 200, response.body);
      assert.match(String(response.headers["set-cookie"]), /; Secure/i);
    } finally { await prod.close(); }
  });
  await t.test("sem SMTP a recuperação fica explicitamente indisponível para qualquer e-mail", async () => {
    const offline = createApp({ logger: false, checkDatabase: async () => {}, authServices: {
      auth: createAuth(database, env), database, env, resetEmailEnabled: false,
    } });
    try {
      for (const email of [admin.email, "ausente@example.invalid"]) {
        const response = await offline.inject({ method: "POST", url: "/api/v1/auth/request-password-reset", payload: { email }, headers: { origin: env.APP_ORIGIN } });
        assert.equal(response.statusCode, 503);
      }
    } finally { await offline.close(); }
  });
  await t.test("logout invalida a sessão no banco", async () => {
    assert.equal((await post("/api/v1/auth/sign-out", {}, adminCookie)).statusCode, 200);
    assert.equal((await get("/api/v1/me", adminCookie)).statusCode, 401);
  });
});
