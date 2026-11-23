import { z } from "zod";
import { AccessError } from "../users/service.js";

export const contentRevision = z.number().int().min(1).max(2_147_483_646);
export const contentReviewStatus = z.enum(["draft", "needs_review", "reviewed"]);
export const contentId = z.strictObject({ id: z.uuid() });

export function parseContent<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AccessError(400, "Revise os campos obrigatórios, formatos e limites do conteúdo.");
  return result.data;
}
