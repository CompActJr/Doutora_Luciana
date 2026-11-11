import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import https from "node:https";

const restored = process.argv.includes("--restored");
const resume = process.argv.includes("--resume");
const port = restored ? 20443 : 18443;
const origin = `https://localhost:${port}`;
const environment = Object.fromEntries((await readFile(restored ? ".env.restore" : ".env.validation", "utf8")).trim().split(/\r?\n/).map(line => line.split(/=(.*)/s).slice(0, 2)));
const ca = await readFile(`backups/validation/${restored ? "restore" : "caddy"}-root.crt`);
function request(path, { method = "GET", cookie, body, targetPort = port, requestOrigin = origin } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: "localhost", port: targetPort, path, method, ca, headers: {
      ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json", origin: requestOrigin } : {}),
    } }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.setTimeout(20000, () => req.destroy(new Error("HTTP timeout")));
    req.on("error", reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}
const expect = async (path, status, options) => {
  const result = await request(path, options);
  assert.equal(result.status, status, `${path}: HTTP ${result.status}, esperado ${status}`);
  return result;
};
await expect("/api/v1/ready", 200);
await expect("/health", 200);
await expect("/login", 200);
await expect("/api/v1/me", 401);
assert.match((await expect("/respostas", 307)).headers.location, /login/);
await expect("/images/logos/dra_luciana_logo_icon.png", 200);
await expect("/docs/PLANO_DO_PROJETO.md", 404);
await expect("/.env", 404);
await expect("/healthz/readiness", 200, { targetPort: restored ? 20567 : 18567 });
let cookies;
if ((resume || restored) && !process.argv.includes("--fresh")) {
  cookies = JSON.parse(await readFile("backups/validation/sessions.json", "utf8"));
} else {
  cookies = {};
  for (const role of ["admin", "editor"]) {
    const result = await expect("/api/v1/auth/sign-in/email", 200, { method: "POST", body: { email: `${role}@validation.invalid`, password: environment.VALIDATION_PASSWORD } });
    const values = result.headers["set-cookie"];
    assert.ok(values?.some(value => /HttpOnly/i.test(value) && /; Secure/i.test(value) && /SameSite=Lax/i.test(value)), "Cookie de produção deve ser Secure, HttpOnly e SameSite=Lax");
    cookies[role] = values.map(value => value.split(";")[0]).join("; ");
  }
  await writeFile(`backups/validation/${restored ? "restore-sessions" : "sessions"}.json`, JSON.stringify(cookies), { mode: 0o600 });
}
for (const role of ["admin", "editor"]) {
  const options = { cookie: cookies[role] };
  const me = await expect("/api/v1/me", 200, options);
  assert.equal(JSON.parse(me.body).user.role, role);
  await expect("/respostas", 200, options);
  await expect("/api/v1/users", role === "admin" ? 200 : 403, options);
  await expect("/configuracoes/usuarios", role === "admin" ? 200 : 307, options);
}
await expect("/api/v1/auth/sign-out", 403, { method: "POST", cookie: cookies.admin, requestOrigin: "https://hostile.invalid", body: {} });
if (process.argv.includes("--owner")) {
  // Apenas o n8n descartável, sem integrações externas.
  await expect("/rest/owner/setup", 200, { targetPort: 18567, method: "POST", requestOrigin: "https://localhost:18567", body: {
    firstName: "Validation", lastName: "Only", email: "owner@validation.invalid", password: `${environment.VALIDATION_PASSWORD.slice(0, 20)}Aa1!`,
  } });
}
console.log(`HTTPS ${restored ? "restaurado" : resume ? "após reinício" : "produção local"}: saúde, proxy, páginas, cookies, sessões, permissões e origem aprovados.`);
