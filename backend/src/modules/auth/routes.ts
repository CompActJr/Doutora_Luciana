import { isIP } from "node:net";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import type { Environment } from "../../config/env.js";
import type { createDatabase } from "../../plugins/database.js";
import type { AppAuth } from "./auth.js";
import { AccessError, createUser, createUserSchema, userSelect } from "../users/service.js";
import { registerResponseRoutes } from "../responses/routes.js";
import { registerKnowledgeRoutes } from "../knowledge/routes.js";
import { registerAssistantRoutes } from "../assistant/routes.js";
import { registerContentRoutes } from "../content/routes.js";
import { registerSimulationRoutes } from "../simulation/routes.js";
import { createAiProvider, type AiProvider } from "../ai/provider.js";
import { registerCalendarRoutes } from "../calendar/routes.js";
import { createGoogleCalendarProvider, type GoogleCalendarProvider } from "../calendar/google.js";

export type AuthServices = { auth: AppAuth; database: ReturnType<typeof createDatabase>; env: Environment; resetEmailEnabled: boolean; aiProvider?: AiProvider; calendarProvider?: GoogleCalendarProvider };

const exposedAuthRoutes = new Set(["sign-in/email", "sign-out", "get-session", "request-password-reset", "reset-password", "change-password"]);

export async function registerAuthRoutes(app: FastifyInstance, { auth, database, env, resetEmailEnabled, aiProvider, calendarProvider }: AuthServices) {
  app.addHook("onRequest", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
    // Todas as operações de navegador que alteram estado exigem a origem exata.
    if (request.headers.origin !== env.APP_ORIGIN) return reply.code(403).send({ message: "Origem não permitida." });
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      return reply.code(415).send({ message: "Envie dados em JSON." });
    }
  });

  app.route({ method: ["GET", "POST"], url: "/api/v1/auth/*", handler: async (request, reply) => {
    const relative = request.url.split("?")[0].slice("/api/v1/auth/".length);
    // O link de recuperação emitido pelo Better Auth redireciona para a página com o token.
    const resetLink = request.method === "GET" && /^reset-password\/[A-Za-z0-9_-]+$/.test(relative);
    if (!exposedAuthRoutes.has(relative) && !resetLink) return reply.code(404).send({ message: "Rota não encontrada." });
    if (relative === "request-password-reset" && !resetEmailEnabled) {
      return reply.code(503).send({ message: "Recuperação por e-mail indisponível. Contate a administradora." });
    }
    const headers = fromNodeHeaders(request.headers);
    const proxyIP = request.headers["x-dra-proxy-client-ip"];
    const clientIP = env.AUTH_TRUST_PROXY && typeof proxyIP === "string" && isIP(proxyIP) ? proxyIP : request.ip;
    headers.set("x-dra-client-ip", clientIP);
    // URL canônica: não confiar no Host enviado pelo cliente.
    const response = await auth.handler(new Request(new URL(request.url, env.APP_ORIGIN), {
      method: request.method, headers,
      ...(request.method === "POST" ? { body: JSON.stringify(request.body ?? {}) } : {}),
    }));
    reply.code(response.status);
    response.headers.forEach((value, key) => { if (key !== "set-cookie") reply.header(key, value); });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) reply.header("set-cookie", cookies);
    return reply.send(response.body ? await response.text() : null);
  } });

  async function currentUser(request: FastifyRequest, admin = false) {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) throw new AccessError(401, "Faça login para continuar.");
    // Sempre consultar o usuário: revogação e mudanças de perfil têm efeito imediato.
    const user = await database.user.findUnique({ where: { id: session.user.id }, select: userSelect });
    if (!user || user.disabled) throw new AccessError(401, "Acesso indisponível.");
    if (admin && user.role !== "admin") throw new AccessError(403, "Acesso restrito à administradora.");
    return user;
  }

  app.get("/api/v1/me", async (request) => ({ user: await currentUser(request) }));
  app.get("/api/v1/users", async (request) => {
    await currentUser(request, true);
    return { users: await database.user.findMany({ select: userSelect, orderBy: { createdAt: "asc" }, take: 200 }) };
  });
  app.post("/api/v1/users", async (request, reply) => {
    await currentUser(request, true);
    const input = createUserSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ message: "Informe nome, e-mail, perfil e senha de 12 a 128 caracteres." });
    try {
      const created = await createUser(database, input.data);
      const user = await database.user.findUniqueOrThrow({ where: { id: created.id }, select: userSelect });
      return reply.code(201).send({ user });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return reply.code(409).send({ message: "Já existe um usuário com esse e-mail." });
      }
      throw error;
    }
  });
  app.patch("/api/v1/users/:id", async (request, reply) => {
    const actor = await currentUser(request, true);
    const input = z.strictObject({ role: z.enum(["admin", "editor"]).optional(), disabled: z.boolean().optional() })
      .refine((value) => Object.keys(value).length > 0).safeParse(request.body);
    if (!input.success) return reply.code(400).send({ message: "Informe um perfil ou estado de acesso válido." });
    const { id } = request.params as { id: string };
    if (actor.id === id && (input.data.disabled === true || input.data.role === "editor")) {
      return reply.code(409).send({ message: "Você não pode remover seu próprio acesso administrativo." });
    }
    try {
      const user = await database.$transaction(async (transaction) => {
        const target = await transaction.user.findUnique({ where: { id } });
        if (!target) throw new AccessError(404, "Usuário não encontrado.");
        if (target.role === "admin" && !target.disabled && (input.data.role === "editor" || input.data.disabled === true)) {
          if (await transaction.user.count({ where: { role: "admin", disabled: false } }) <= 1) {
            throw new AccessError(409, "É necessário manter uma administradora ativa.");
          }
        }
        const updated = await transaction.user.update({ where: { id }, data: input.data, select: userSelect });
        await transaction.session.deleteMany({ where: { userId: id } });
        return updated;
      }, { isolationLevel: "Serializable" });
      return { user };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
        return reply.code(409).send({ message: "Outro acesso foi alterado. Atualize a lista e tente novamente." });
      }
      throw error;
    }
  });
  app.post("/api/v1/users/:id/revoke-sessions", async (request) => {
    await currentUser(request, true);
    const { id } = request.params as { id: string };
    await database.session.deleteMany({ where: { userId: id } });
    return { success: true };
  });

  await registerResponseRoutes(app, { database, currentUser });
  await registerKnowledgeRoutes(app, { database, currentUser });
  await registerAssistantRoutes(app, { database, currentUser });
  await registerContentRoutes(app, { database, currentUser });
  await registerSimulationRoutes(app, { database, currentUser, provider: aiProvider ?? createAiProvider(env) });
  await registerCalendarRoutes(app, { database, env, currentUser, provider: calendarProvider ?? (env.GOOGLE_CALENDAR_CLIENT_ID && env.GOOGLE_CALENDAR_CLIENT_SECRET ? createGoogleCalendarProvider(env.GOOGLE_CALENDAR_CLIENT_ID, env.GOOGLE_CALENDAR_CLIENT_SECRET) : undefined) });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AccessError) return reply.code(error.statusCode).send({ message: error.message });
    if (typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ message: "Requisição inválida." });
    }
    return reply.code(500).send({ message: "Não foi possível concluir a operação." });
  });
}
