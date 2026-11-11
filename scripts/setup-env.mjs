import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

// Criação exclusiva: nunca substituir uma configuração ou chave existente.
const content = await readFile(new URL("../.env.example", import.meta.url), "utf8");
const secrets = Object.fromEntries(
  ["POSTGRES_PASSWORD", "APP_DB_PASSWORD", "N8N_DB_PASSWORD", "N8N_ENCRYPTION_KEY", "BETTER_AUTH_SECRET", "N8N_SERVICE_TOKEN"]
    .map((name) => [name, randomBytes(32).toString("hex")]),
);
secrets.DATABASE_URL = `postgresql://dra_app:${secrets.APP_DB_PASSWORD}@localhost:5432/dra_app`;
const output = content.replace(/^([A-Z0-9_]+)=$/gm, (line, key) => key in secrets ? `${key}=${secrets[key]}` : line);
await writeFile(new URL("../.env", import.meta.url), output, { flag: "wx", mode: 0o600 });
console.log(".env local criado com segredos aleatórios. Nenhum segredo foi exibido.");
