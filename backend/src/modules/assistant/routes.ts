import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { createDatabase } from "../../plugins/database.js";
import { AccessError } from "../users/service.js";
import { parseContent } from "../content/validation.js";

const settingsSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(80),
  introduction: z.string().trim().min(1).max(2000),
  tone: z.string().trim().min(1).max(2000),
  boundaries: z.string().trim().min(1).max(4000),
  handoffTriggers: z.array(z.string().trim().min(1).max(300)).min(1).max(20),
  handoffMessage: z.string().trim().min(1).max(3000),
  schedulingInstructions: z.string().trim().min(1).max(2000),
  revision: z.number().int().min(0).max(2_147_483_646),
});
type Services = { database: ReturnType<typeof createDatabase>; currentUser: (request: FastifyRequest) => Promise<{ id: string }> };

export async function registerAssistantRoutes(app: FastifyInstance, { database, currentUser }: Services) {
  app.get("/api/v1/assistant-settings", async (request) => {
    await currentUser(request);
    return { settings: await database.assistantSettings.findUnique({ where: { id: "clinic" } }) };
  });
  app.put("/api/v1/assistant-settings", async (request) => {
    await currentUser(request);
    const { revision, ...data } = parseContent(settingsSchema, request.body);
    if (revision === 0) {
      try {
        return { settings: await database.assistantSettings.create({ data: { ...data, id: "clinic" } }) };
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
          throw new AccessError(409, "A configuração já foi criada. Reabra a versão atual.");
        }
        throw error;
      }
    }
    const settings = await database.$transaction(async (transaction) => {
      const result = await transaction.assistantSettings.updateMany({ where: { id: "clinic", revision }, data: { ...data, revision: { increment: 1 } } });
      if (!result.count) throw new AccessError(409, "A configuração foi alterada ou ainda não existe. Reabra a versão atual.");
      return transaction.assistantSettings.findUniqueOrThrow({ where: { id: "clinic" } });
    });
    return { settings };
  });
}
