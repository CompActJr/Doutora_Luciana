import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const secrets = Object.fromEntries(["POSTGRES_PASSWORD", "APP_DB_PASSWORD", "N8N_DB_PASSWORD", "N8N_ENCRYPTION_KEY", "BETTER_AUTH_SECRET", "N8N_SERVICE_TOKEN", "VALIDATION_PASSWORD"]
  .map((key) => [key, randomBytes(32).toString("hex")]));
const environment = {
  ...secrets, APP_VERSION: "validation", PANEL_DOMAIN: "localhost:18443", N8N_DOMAIN: "localhost:18567",
  APP_ORIGIN: "https://localhost:18443", ACME_EMAIL: "validation@example.invalid", TZ: "America/Sao_Paulo",
};
try {
  await writeFile(".env.validation", Object.entries(environment).map(([key, value]) => `${key}=${value}`).join("\n") + "\n", { flag: "wx", mode: 0o600 });
} catch (error) { if (error.code !== "EEXIST") throw error; }
const existing = await readFile(".env.validation", "utf8");
try {
  await writeFile(".env.restore", existing.replaceAll("18443", "20443").replaceAll("18567", "20567"), { flag: "wx", mode: 0o600 });
} catch (error) { if (error.code !== "EEXIST") throw error; }
await mkdir("backups/validation", { recursive: true });
try { await writeFile("backups/validation/restic-password", randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 }); }
catch (error) { if (error.code !== "EEXIST") throw error; }
console.log("Ambientes de ensaio preparados com segredos próprios; .env e volumes de desenvolvimento preservados.");
