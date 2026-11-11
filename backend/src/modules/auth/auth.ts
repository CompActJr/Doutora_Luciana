import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import type { Environment } from "../../config/env.js";
import type { createDatabase } from "../../plugins/database.js";
import type { ResetMailer } from "./mail.js";

export function createAuth(database: ReturnType<typeof createDatabase>, env: Environment, sendMail?: ResetMailer) {
  return betterAuth({
    appName: "Painel Dra. Luciana",
    baseURL: env.APP_ORIGIN,
    basePath: "/api/v1/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: prismaAdapter(database, { provider: "postgresql" }),
    trustedOrigins: [env.APP_ORIGIN],
    emailAndPassword: {
      enabled: true, disableSignUp: true,
      minPasswordLength: 12, maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: sendMail ? async ({ user, url }) => { await sendMail({ email: user.email, url }); } : undefined,
    },
    user: { additionalFields: {
      role: { type: ["admin", "editor"], defaultValue: "editor", input: false },
      disabled: { type: "boolean", defaultValue: false, input: false },
    } },
    session: {
      expiresIn: 8 * 60 * 60,
      updateAge: 30 * 60,
      cookieCache: { enabled: false },
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === "production",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      ipAddress: { ipAddressHeaders: ["x-dra-client-ip"] },
    },
    rateLimit: {
      enabled: true, storage: "database", window: 60, max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/reset-password": { window: 60, max: 5 },
      },
    },
    databaseHooks: { session: { create: { before: async (session) => {
      const user = await database.user.findUnique({ where: { id: session.userId }, select: { disabled: true } });
      if (!user || user.disabled) return false;
    } } } },
    // Erros de autenticação não devem escrever tokens, senhas ou endereços em logs.
    logger: { disabled: true },
  });
}

export type AppAuth = ReturnType<typeof createAuth>;
