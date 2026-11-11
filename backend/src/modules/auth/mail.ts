import nodemailer from "nodemailer";
import type { Environment } from "../../config/env.js";

export type ResetMailer = (message: { email: string; url: string }) => Promise<void>;

export function createResetMailer(env: Environment): ResetMailer | undefined {
  if (!env.SMTP_HOST || !env.SMTP_FROM) return undefined;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE,
    requireTLS: !env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    logger: false, debug: false,
    connectionTimeout: 10_000, socketTimeout: 15_000,
  });
  return async ({ email, url }) => {
    await transport.sendMail({
      from: env.SMTP_FROM, to: email,
      subject: "Redefinir senha — Painel Dra. Luciana",
      text: `Recebemos uma solicitação para redefinir sua senha.\n\nAcesse o link abaixo em até 30 minutos:\n${url}\n\nSe não foi você, ignore esta mensagem.`,
    });
  };
}
