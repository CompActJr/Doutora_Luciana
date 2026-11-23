import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import type { createDatabase } from "../../plugins/database.js";
import { AccessError } from "../users/service.js";
import { contentId, contentRevision, contentReviewStatus, parseContent } from "../content/validation.js";

const entrySchema = z.strictObject({
  title: z.string().trim().min(3).max(120),
  category: z.string().trim().min(1).max(80),
  content: z.string().trim().min(1).max(12_000),
  reviewStatus: contentReviewStatus,
});
const updateSchema = entrySchema.partial().extend({ revision: contentRevision, isActive: z.boolean().optional() })
  .refine((input) => Object.keys(input).some((key) => key !== "revision"));
const querySchema = z.strictObject({
  search: z.string().trim().max(200).default(""), category: z.string().trim().max(80).optional(),
  state: z.enum(["active", "inactive", "all"]).default("active"), reviewStatus: contentReviewStatus.optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
});
type Services = { database: ReturnType<typeof createDatabase>; currentUser: (request: FastifyRequest) => Promise<{ id: string }> };

// Herda as proteções de origem, JSON e sessão do escopo que registra o módulo.
export async function registerKnowledgeRoutes(app: FastifyInstance, { database, currentUser }: Services) {
  app.get("/api/v1/knowledge", async (request) => {
    await currentUser(request);
    const query = parseContent(querySchema, request.query);
    const where: Prisma.KnowledgeEntryWhereInput = {
      ...(query.state !== "all" ? { isActive: query.state === "active" } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
      ...(query.search ? { OR: ["title", "category", "content"].map((field) => ({ [field]: { contains: query.search, mode: "insensitive" } })) } : {}),
    };
    const pageSize = 20;
    const [items, total, categories] = await database.$transaction([
      database.knowledgeEntry.findMany({ where, select: { id: true, title: true, category: true, reviewStatus: true, isActive: true, revision: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (query.page - 1) * pageSize, take: pageSize }),
      database.knowledgeEntry.count({ where }),
      database.knowledgeEntry.findMany({ select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
    ]);
    return { items, total, page: query.page, pageSize, categories: categories.map((item) => item.category) };
  });
  app.get("/api/v1/knowledge/:id", async (request) => {
    await currentUser(request);
    const { id } = parseContent(contentId, request.params);
    const entry = await database.knowledgeEntry.findUnique({ where: { id } });
    if (!entry) throw new AccessError(404, "Informação não encontrada.");
    return { entry };
  });
  app.post("/api/v1/knowledge", async (request, reply) => {
    await currentUser(request);
    const entry = await database.knowledgeEntry.create({ data: parseContent(entrySchema, request.body) });
    return reply.code(201).send({ entry });
  });
  app.patch("/api/v1/knowledge/:id", async (request) => {
    await currentUser(request);
    const { id } = parseContent(contentId, request.params);
    const { revision, ...data } = parseContent(updateSchema, request.body);
    const contentChanged = ["title", "category", "content"].some((key) => key in data);
    const entry = await database.$transaction(async (transaction) => {
      const result = await transaction.knowledgeEntry.updateMany({ where: { id, revision }, data: {
        ...data, ...(contentChanged && data.reviewStatus === undefined ? { reviewStatus: "draft" } : {}), revision: { increment: 1 },
      } });
      if (!result.count) {
        const exists = await transaction.knowledgeEntry.findUnique({ where: { id }, select: { id: true } });
        throw new AccessError(exists ? 409 : 404, exists ? "Esta informação foi alterada. Reabra a versão atual." : "Informação não encontrada.");
      }
      return transaction.knowledgeEntry.findUniqueOrThrow({ where: { id } });
    });
    return { entry };
  });
}
