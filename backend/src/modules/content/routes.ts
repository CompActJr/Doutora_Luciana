import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { createDatabase } from "../../plugins/database.js";
import { AccessError } from "../users/service.js";
import { parseContent, contentId } from "./validation.js";
import { concurrencyError, fingerprint, publicationIssues, readSnapshot, snapshotFromJson } from "./versions.js";
import { panelOpenApi } from "./openapi.js";

const activation = z.strictObject({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/), expectedActiveVersionId: z.uuid().nullable(), note: z.string().trim().min(3).max(500), confirmInternalOnly: z.literal(true) });
const summary = { id: true, number: true, fingerprint: true, note: true, actorId: true, restoredFrom: true, createdAt: true } as const;
type Services = { database: ReturnType<typeof createDatabase>; currentUser: (request: FastifyRequest, admin?: boolean) => Promise<{ id: string }> };

export async function registerContentRoutes(app: FastifyInstance, { database, currentUser }: Services) {
  app.get("/api/v1/openapi.json", async (request) => { await currentUser(request); return panelOpenApi; });
  app.get("/api/v1/content/draft", async (request) => {
    await currentUser(request);
    return database.$transaction(async (tx) => {
      const snapshot = await readSnapshot(tx);
      const release = await tx.contentRelease.findUnique({ where: { id: "clinic" } });
      return { snapshot, fingerprint: fingerprint(snapshot), issues: publicationIssues(snapshot), activeVersionId: release?.versionId ?? null };
    }, { isolationLevel: "RepeatableRead" });
  });
  app.get("/api/v1/content/versions", async (request) => {
    await currentUser(request);
    const { page } = parseContent(z.strictObject({ page: z.coerce.number().int().min(1).max(100000).default(1) }), request.query);
    const [items, total, release] = await database.$transaction([
      database.contentVersion.findMany({ select: summary, orderBy: { number: "desc" }, skip: (page - 1) * 20, take: 20 }),
      database.contentVersion.count(), database.contentRelease.findUnique({ where: { id: "clinic" } }),
    ]);
    return { items, total, page, pageSize: 20, activeVersionId: release?.versionId ?? null };
  });
  app.get("/api/v1/content/versions/:id", async (request) => {
    await currentUser(request);
    const id = parseContent(contentId, request.params).id;
    const version = await database.contentVersion.findUnique({ where: { id } });
    if (!version) throw new AccessError(404, "Versão não encontrada.");
    return { version };
  });
  app.post("/api/v1/content/versions", async (request, reply) => {
    const actor = await currentUser(request, true);
    const input = parseContent(activation, request.body);
    try {
      const version = await database.$transaction(async (tx) => {
        const release = await tx.contentRelease.findUnique({ where: { id: "clinic" } });
        if ((release?.versionId ?? null) !== input.expectedActiveVersionId) throw new AccessError(409, "A versão ativa mudou. Atualize a prévia.");
        const snapshot = await readSnapshot(tx);
        if (fingerprint(snapshot) !== input.fingerprint) throw new AccessError(409, "Os rascunhos mudaram. Atualize a prévia.");
        const issues = publicationIssues(snapshot);
        if (issues.length) throw new AccessError(409, issues.join(" "));
        const created = await tx.contentVersion.create({ data: { snapshot: JSON.parse(JSON.stringify(snapshot)), fingerprint: input.fingerprint, note: input.note, actorId: actor.id } });
        await tx.contentRelease.upsert({ where: { id: "clinic" }, create: { id: "clinic", versionId: created.id }, update: { versionId: created.id, revision: { increment: 1 } } });
        return created;
      }, { isolationLevel: "Serializable" });
      return reply.code(201).send({ version });
    } catch (error) { concurrencyError(error); }
  });
  app.post("/api/v1/content/versions/:id/restore", async (request, reply) => {
    const actor = await currentUser(request, true);
    const id = parseContent(contentId, request.params).id;
    const input = parseContent(activation.omit({ fingerprint: true }), request.body);
    try {
      const version = await database.$transaction(async (tx) => {
        const release = await tx.contentRelease.findUnique({ where: { id: "clinic" } });
        if ((release?.versionId ?? null) !== input.expectedActiveVersionId) throw new AccessError(409, "A versão ativa mudou. Atualize o histórico.");
        const source = await tx.contentVersion.findUnique({ where: { id } });
        if (!source) throw new AccessError(404, "Versão não encontrada.");
        const snapshot = snapshotFromJson(source.snapshot);
        if (publicationIssues(snapshot).length) throw new AccessError(409, "Esta versão não atende aos critérios de ativação.");
        const created = await tx.contentVersion.create({ data: { snapshot: source.snapshot!, fingerprint: source.fingerprint, note: input.note, actorId: actor.id, restoredFrom: source.id } });
        await tx.contentRelease.upsert({ where: { id: "clinic" }, create: { id: "clinic", versionId: created.id }, update: { versionId: created.id, revision: { increment: 1 } } });
        return created;
      }, { isolationLevel: "Serializable" });
      return reply.code(201).send({ version });
    } catch (error) { concurrencyError(error); }
  });
}

