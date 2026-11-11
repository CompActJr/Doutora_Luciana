import { z } from "zod";

const optionalText = z.preprocess((value) => value === "" ? undefined : value, z.string().optional());

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.url().refine((value) => /^postgres(ql)?:/.test(value)),
  APP_ORIGIN: z.url().refine((value) => new URL(value).origin === value && ["http:", "https:"].includes(new URL(value).protocol)).default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32),
  AUTH_TRUST_PROXY: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SMTP_HOST: optionalText,
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SMTP_USER: optionalText,
  SMTP_PASSWORD: optionalText,
  SMTP_FROM: optionalText,
}).superRefine((env, context) => {
  if (env.NODE_ENV === "production" && !env.APP_ORIGIN.startsWith("https://")) {
    context.addIssue({ code: "custom", path: ["APP_ORIGIN"], message: "HTTPS obrigatório." });
  }
  if ((env.SMTP_HOST && !env.SMTP_FROM) || (!env.SMTP_HOST && env.SMTP_FROM)) {
    context.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "Configure servidor e remetente SMTP." });
  }
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) {
    context.addIssue({ code: "custom", path: ["SMTP_USER"], message: "Configure usuário e senha SMTP." });
  }
});

export type Environment = z.infer<typeof environmentSchema>;

export function readEnvironment(source: NodeJS.ProcessEnv = process.env) {
  const result = environmentSchema.safeParse(source);
  if (!result.success) {
    // Nunca imprimir os valores recebidos, que podem conter credenciais.
    throw new Error(`Configuração inválida: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }
  return result.data;
}
