import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import type { createDatabase } from "../../plugins/database.js";

export const createUserSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(12).max(128),
  role: z.enum(["admin", "editor"]).default("editor"),
});

export class AccessError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

export async function createUser(database: ReturnType<typeof createDatabase>, input: z.input<typeof createUserSchema>, bootstrap = false) {
  const data = createUserSchema.parse(input);
  const password = await hashPassword(data.password);
  const id = randomUUID();
  return database.$transaction(async (transaction) => {
    // Serializa a criação inicial: duas execuções não podem cadastrar duas primeiras admins.
    if (bootstrap && await transaction.user.count() !== 0) {
      throw new AccessError(409, "Já existem usuários. Use a administração do painel.");
    }
    return transaction.user.create({ data: {
      id, name: data.name, email: data.email, role: data.role,
      accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password } },
    } });
  }, { isolationLevel: "Serializable" });
}

export const userSelect = { id: true, name: true, email: true, role: true, disabled: true, createdAt: true } as const;
