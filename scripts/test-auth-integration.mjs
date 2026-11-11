import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.loadEnvFile(new URL("../.env", import.meta.url));
const connection = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(connection.hostname) || connection.pathname !== "/dra_app") {
  throw new Error("O teste exige o .env local, com DATABASE_URL apontando para dra_app em localhost.");
}
const pnpmPath = process.env.npm_execpath;
if (!pnpmPath) throw new Error("Execute com pnpm run test:integration.");
const pnpm = /\.[cm]?js$/.test(pnpmPath) ? [process.execPath, [pnpmPath]] : [pnpmPath, []];
const compose = ["compose", "--env-file", ".env", "-f", "compose.yaml", "-f", "compose.dev.yaml"];
const database = `dra_auth_test_${randomUUID().replaceAll("-", "")}`;
let created = false;
const smtp = process.argv.includes("--smtp");
let smtpStarted = false;
const smtpCompose = ["compose", "-f", "infra/testing/compose.smtp.yaml"];
const certDirectory = fileURLToPath(new URL("../backups/validation/smtp-certs", import.meta.url));

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.error || result.status !== 0) throw new Error(`Verificação interrompida (${command.split(/[\\/]/).pop()}).`);
}
try {
  if (smtp) {
    mkdirSync(certDirectory, { recursive: true });
    const openssl = process.platform === "win32" && existsSync("C:/Program Files/Git/usr/bin/openssl.exe")
      ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl";
    const certificateValid = existsSync(path.join(certDirectory, "cert.pem")) && existsSync(path.join(certDirectory, "key.pem"))
      && spawnSync(openssl, ["x509", "-checkend", "86400", "-noout", "-in", path.join(certDirectory, "cert.pem")], { stdio: "ignore" }).status === 0;
    if (!certificateValid) {
      run(openssl, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "7",
        "-keyout", path.join(certDirectory, "key.pem"), "-out", path.join(certDirectory, "cert.pem"),
        "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"]);
    }
    smtpStarted = true;
    run("docker", [...smtpCompose, "up", "-d", "--no-build", "--wait"]);
  }
  run("docker", [...compose, "up", "-d", "--no-build", "--wait", "postgres"]);
  run("docker", [...compose, "exec", "-T", "postgres", "createdb", "-U", "postgres", "-O", "dra_app", database]);
  created = true;
  connection.pathname = `/${database}`;
  const env = { ...process.env, DATABASE_URL: connection.toString(), TEST_DATABASE_URL: connection.toString() };
  if (smtp) {
    env.TEST_SMTP_API = "http://127.0.0.1:18025";
    env.NODE_EXTRA_CA_CERTS = path.join(certDirectory, "cert.pem");
  }
  run(pnpm[0], [...pnpm[1], "run", "db:migrate"], env);
  run(pnpm[0], [...pnpm[1], "--filter", "@dra/backend", "run", "test:integration"], env);
} finally {
  try {
    if (created) run("docker", [...compose, "exec", "-T", "postgres", "dropdb", "-U", "postgres", "--force", database]);
  } finally {
    if (smtpStarted) run("docker", [...smtpCompose, "down"]);
  }
}
