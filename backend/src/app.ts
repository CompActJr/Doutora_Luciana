import Fastify, { LogController } from "fastify";
import type { HealthResponse, ReadinessResponse } from "@dra/contracts";
import { registerAuthRoutes, type AuthServices } from "./modules/auth/routes.js";

type AppOptions = { checkDatabase: () => Promise<void>; logger?: boolean; authServices?: AuthServices };

export function createApp({ checkDatabase, logger = true, authServices }: AppOptions) {
  const app = Fastify({
    logger: logger ? {
      level: "info",
      redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
    } : false,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 1_048_576,
    // Somente o Caddy alcança a API em produção; não confiar em headers do cliente.
    trustProxy: false,
  });

  app.get("/api/v1/health", async (): Promise<HealthResponse> => ({ status: "ok" }));
  app.get("/api/v1/ready", async (_request, reply): Promise<ReadinessResponse> => {
    try {
      await checkDatabase();
      return { status: "ready" };
    } catch {
      reply.code(503);
      return { status: "unavailable" };
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    // Não serializar erros que possam conter SQL, dados clínicos ou credenciais.
    const status = typeof error === "object" && error !== null && "statusCode" in error
      && typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500
      ? error.statusCode : 500;
    reply.code(status).send({ message: status < 500 ? "Requisição inválida." : "Erro interno do servidor." });
  });
  if (authServices) app.register(async (scope) => { await registerAuthRoutes(scope, authServices); });
  return app;
}
