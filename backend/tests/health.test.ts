import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { readEnvironment } from "../src/config/env.js";

test("liveness independe do banco; readiness retorna 503 sem expor o erro", async (t) => {
  const app = createApp({ logger: false, checkDatabase: async () => { throw new Error("senha-confidencial"); } });
  t.after(() => app.close());
  const live = await app.inject({ url: "/api/v1/health" });
  assert.equal(live.statusCode, 200);
  const ready = await app.inject({ url: "/api/v1/ready" });
  assert.equal(ready.statusCode, 503);
  assert.deepEqual(ready.json(), { status: "unavailable" });
  assert.ok(!ready.body.includes("senha-confidencial"));
});

test("readiness verifica o banco", async (t) => {
  let checked = false;
  const app = createApp({ logger: false, checkDatabase: async () => { checked = true; } });
  t.after(() => app.close());
  const ready = await app.inject({ url: "/api/v1/ready" });
  assert.equal(ready.statusCode, 200);
  assert.equal(checked, true);
  assert.deepEqual(ready.json(), { status: "ready" });
});

test("configuração inválida não expõe a URL com senha", () => {
  assert.throws(() => readEnvironment({ DATABASE_URL: "senha-confidencial" }), (error: Error) => {
    assert.ok(error.message.includes("DATABASE_URL"));
    assert.ok(!error.message.includes("senha-confidencial"));
    return true;
  });
});

test("produção exige origem HTTPS e configuração SMTP não pode ficar pela metade", () => {
  const base = { DATABASE_URL: "postgresql://local:local@localhost/dra_app", BETTER_AUTH_SECRET: "a".repeat(64) };
  assert.throws(() => readEnvironment({ ...base, NODE_ENV: "production", APP_ORIGIN: "http://painel.example.invalid" }), /APP_ORIGIN/);
  assert.throws(() => readEnvironment({ ...base, SMTP_HOST: "smtp.example.invalid" }), /SMTP_HOST/);
  assert.throws(() => readEnvironment({ ...base, SMTP_USER: "usuario" }), /SMTP_USER/);
  assert.equal(readEnvironment({ ...base, NODE_ENV: "production", APP_ORIGIN: "https://painel.example.invalid" }).NODE_ENV, "production");
});
