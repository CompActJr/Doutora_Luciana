import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createApp } from "../../src/app.js";
import { createAuth } from "../../src/modules/auth/auth.js";
import { createResetMailer } from "../../src/modules/auth/mail.js";
import { readEnvironment } from "../../src/config/env.js";
import { createDatabase } from "../../src/plugins/database.js";
import { createUser } from "../../src/modules/users/service.js";

test("recuperação realmente transmitida por SMTP com STARTTLS e certificado validado", { skip: !process.env.TEST_SMTP_API }, async (t) => {
  assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED, "0", "O teste não permite desabilitar a validação TLS.");
  const untrustedEnvironment = { ...process.env };
  delete untrustedEnvironment.NODE_EXTRA_CA_CERTS;
  const untrusted = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import nodemailer from 'nodemailer';
    const transport = nodemailer.createTransport({ host:'localhost', port:11025, requireTLS:true, connectionTimeout:5000 });
    transport.verify().then(()=>process.exit(1)).catch(error=>process.exit(/self.signed|unable to verify|certificate.*trust/i.test(error.message)?0:2));
  `], { env: untrustedEnvironment, encoding: "utf8", timeout: 15000 });
  assert.equal(untrusted.status, 0, "Sem a CA de teste, a conexão SMTP deve rejeitar o certificado.");
  const databaseURL = process.env.TEST_DATABASE_URL!;
  assert.match(new URL(databaseURL).pathname, /^\/dra_auth_test_[a-z0-9_]+$/);
  const database = createDatabase(databaseURL);
  const env = readEnvironment({
    NODE_ENV: "test", DATABASE_URL: databaseURL, BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    SMTP_HOST: "localhost", SMTP_PORT: "11025", SMTP_SECURE: "false", SMTP_FROM: "painel@example.invalid",
  });
  const auth = createAuth(database, env, createResetMailer(env));
  const app = createApp({ logger: false, checkDatabase: async () => {}, authServices: { auth, database, env, resetEmailEnabled: true } });
  t.after(async () => { await app.close(); await database.$disconnect(); });
  const email = "smtp-validation@example.invalid";
  await createUser(database, { email, name: "Teste SMTP", password: "Senha-inicial-somente-teste!", role: "editor" });
  const post = (path: string, body: object) => app.inject({ method: "POST", url: `/api/v1/auth/${path}`, payload: body,
    headers: { origin: env.APP_ORIGIN }, remoteAddress: "198.51.100.240" });
  const requested = await post("request-password-reset", { email, redirectTo: `${env.APP_ORIGIN}/redefinir-senha` });
  assert.equal(requested.statusCode, 200);
  const list = await (await fetch(`${process.env.TEST_SMTP_API}/api/v1/messages`)).json() as {
    messages: { ID: string; To: { Address: string }[] }[];
  };
  const captured = list.messages.find((message) => message.To.some((recipient) => recipient.Address === email));
  assert.ok(captured, "O capturador deve receber uma mensagem para a conta de teste.");
  const message = await (await fetch(`${process.env.TEST_SMTP_API}/api/v1/message/${captured.ID}`)).json() as { Text: string; From: { Address: string } };
  assert.equal(message.From.Address, "painel@example.invalid");
  const resetURL = message.Text.match(/http:\/\/localhost:3000\/api\/v1\/auth\/reset-password\/[^\s]+/)?.[0];
  assert.ok(resetURL, "O e-mail deve conter o link de recuperação.");
  const link = new URL(resetURL);
  const redirect = await app.inject({ url: `${link.pathname}${link.search}` });
  assert.equal(redirect.statusCode, 302);
  const token = new URL(String(redirect.headers.location)).searchParams.get("token");
  assert.ok(token);
  const newPassword = "Senha-renovada-somente-teste!";
  assert.equal((await post("reset-password", { token, newPassword })).statusCode, 200);
  assert.equal((await post("sign-in/email", { email, password: newPassword })).statusCode, 200);
  assert.equal((await post("sign-in/email", { email, password: "Senha-inicial-somente-teste!" })).statusCode, 401);
});
