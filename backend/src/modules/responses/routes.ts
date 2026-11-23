import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import type { createDatabase } from "../../plugins/database.js";
import { AccessError } from "../users/service.js";

const contentSchema = z.strictObject({
  title: z.string().trim().min(3).max(120),
  category: z.string().trim().min(1).max(80),
  questionExamples: z.array(z.string().trim().min(1).max(500)).max(20),
  answer: z.string().trim().min(1).max(6000),
  variations: z.array(z.string().trim().min(1).max(6000)).max(10),
  reviewStatus: z.enum(["draft", "needs_review", "reviewed"]),
});
const revisionSchema = z.strictObject({ revision: z.number().int().min(1).max(2_147_483_646) });
const updateSchema = contentSchema.partial().extend({
  revision: revisionSchema.shape.revision,
  isActive: z.boolean().optional(),
}).refine((input) => Object.keys(input).some((key) => key !== "revision"));
const querySchema = z.strictObject({
  search: z.string().trim().max(200).default(""),
  category: z.string().trim().max(80).optional(),
  state: z.enum(["active", "inactive", "all"]).default("active"),
  reviewStatus: contentSchema.shape.reviewStatus.optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
});
const idSchema = z.strictObject({ id: z.uuid() });
const summarySelect = {
  id: true, title: true, category: true, reviewStatus: true, isActive: true,
  revision: true, updatedAt: true,
} as const;

type Services = {
  database: ReturnType<typeof createDatabase>;
  currentUser: (request: FastifyRequest) => Promise<{ id: string }>;
};

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AccessError(400, "Revise os campos e os limites do modelo de resposta.");
  return result.data;
}

// Registrar dentro do escopo protegido: herda origem/JSON, no-store e erros seguros.
// Admin e editor podem trabalhar nos rascunhos. Não há rotas de publicação/envio.
export async function registerResponseRoutes(app: FastifyInstance, { database, currentUser }: Services) {
  app.get("/api/v1/responses", async (request) => {
    await currentUser(request);
    const query = parse(querySchema, request.query);
    const where: Prisma.ResponseTemplateWhereInput = {
      ...(query.state !== "all" ? { isActive: query.state === "active" } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
      ...(query.search ? { OR: ["title", "answer", "category"].map((field) => ({
        [field]: { contains: query.search, mode: "insensitive" },
      })) } : {}),
    };
    const pageSize = 20;
    const [items, total, categories] = await database.$transaction([
      database.responseTemplate.findMany({ where, select: summarySelect,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (query.page - 1) * pageSize, take: pageSize }),
      database.responseTemplate.count({ where }),
      database.responseTemplate.findMany({ select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
    ]);
    return { items, total, page: query.page, pageSize, categories: categories.map((item) => item.category) };
  });

  app.get("/api/v1/responses/:id", async (request) => {
    await currentUser(request);
    const { id } = parse(idSchema, request.params);
    const response = await database.responseTemplate.findUnique({ where: { id } });
    if (!response) throw new AccessError(404, "Modelo não encontrado.");
    return { response };
  });

  app.post("/api/v1/responses", async (request, reply) => {
    await currentUser(request);
    const input = parse(contentSchema, request.body);
    const response = await database.responseTemplate.create({ data: input });
    return reply.code(201).send({ response });
  });

  app.patch("/api/v1/responses/:id", async (request) => {
    await currentUser(request);
    const { id } = parse(idSchema, request.params);
    const { revision, ...data } = parse(updateSchema, request.body);
    // Uma alteração de conteúdo volta a rascunho, salvo revisão explicitamente escolhida.
    const contentChanged = ["title", "category", "questionExamples", "answer", "variations"].some((key) => key in data);
    const response = await database.$transaction(async (transaction) => {
      const result = await transaction.responseTemplate.updateMany({ where: { id, revision }, data: {
        ...data, ...(contentChanged && data.reviewStatus === undefined ? { reviewStatus: "draft" } : {}),
        revision: { increment: 1 },
      } });
      if (!result.count) {
        const exists = await transaction.responseTemplate.findUnique({ where: { id }, select: { id: true } });
        throw new AccessError(exists ? 409 : 404, exists
          ? "Este modelo foi alterado por outra pessoa. Reabra a versão atual antes de salvar."
          : "Modelo não encontrado.");
      }
      return transaction.responseTemplate.findUniqueOrThrow({ where: { id } });
    });
    return { response };
  });

  app.post("/api/v1/responses/:id/duplicate", async (request, reply) => {
    await currentUser(request);
    const { id } = parse(idSchema, request.params);
    const { revision } = parse(revisionSchema, request.body);
    const source = await database.responseTemplate.findUnique({ where: { id } });
    if (!source) throw new AccessError(404, "Modelo não encontrado.");
    if (source.revision !== revision) throw new AccessError(409, "Reabra a versão atual antes de duplicar.");
    const response = await database.responseTemplate.create({ data: {
      title: `${source.title.slice(0, 112)} (cópia)`, category: source.category,
      questionExamples: source.questionExamples, answer: source.answer, variations: source.variations,
      reviewStatus: "draft", isActive: true,
    } });
    return reply.code(201).send({ response });
  });
}
