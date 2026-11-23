import { createHash } from "node:crypto";
import type { ContentSnapshot } from "@dra/contracts";
import type { Prisma } from "../../generated/prisma/client.js";
import { AccessError } from "../users/service.js";

export async function readSnapshot(database: Prisma.TransactionClient): Promise<ContentSnapshot> {
  const [responses, knowledge, assistant] = await Promise.all([
    database.responseTemplate.findMany({ orderBy: { id: "asc" } }),
    database.knowledgeEntry.findMany({ orderBy: { id: "asc" } }),
    database.assistantSettings.findUnique({ where: { id: "clinic" } }),
  ]);
  return JSON.parse(JSON.stringify({ schemaVersion: 1, responses, knowledge, assistant })) as ContentSnapshot;
}
export function fingerprint(snapshot: ContentSnapshot) {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
  return createHash("sha256").update(JSON.stringify(canonical(snapshot))).digest("hex");
}
export function publicationIssues(snapshot: ContentSnapshot): string[] {
  const issues: string[] = [];
  if (!snapshot.assistant) issues.push("Salve a configuração da assistente.");
  const active = [...snapshot.responses, ...snapshot.knowledge].filter((item) => item.isActive);
  if (!active.length) issues.push("Cadastre pelo menos uma resposta ou informação ativa.");
  const pending = active.filter((item) => item.reviewStatus !== "reviewed").length;
  if (pending) issues.push(`Revise os ${pending} conteúdos ativos antes de ativar uma versão interna.`);
  if (JSON.stringify(snapshot).length > 1_000_000) issues.push("O conjunto de conteúdo excede o limite de uma versão (1 milhão de caracteres).");
  return issues;
}
export function snapshotFromJson(value: unknown): ContentSnapshot {
  const snapshot = value as ContentSnapshot;
  if (!snapshot || snapshot.schemaVersion !== 1) throw new AccessError(409, "Formato de versão não suportado.");
  return snapshot;
}
export function concurrencyError(error: unknown): never {
  if (error && typeof error === "object" && "code" in error && ["P2034", "P2002"].includes(String(error.code))) {
    throw new AccessError(409, "O conteúdo ou a versão ativa mudou. Atualize a prévia e tente novamente.");
  }
  throw error;
}
