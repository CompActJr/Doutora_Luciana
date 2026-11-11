import { createApp } from "./app.js";
import { readEnvironment } from "./config/env.js";
import { createDatabase } from "./plugins/database.js";
import { createAuth } from "./modules/auth/auth.js";
import { createResetMailer } from "./modules/auth/mail.js";

const env = readEnvironment();
const database = createDatabase(env.DATABASE_URL);
const sendMail = createResetMailer(env);
const auth = createAuth(database, env, sendMail);
const app = createApp({
  checkDatabase: async () => { await database.$queryRaw`SELECT 1`; },
  authServices: { auth, database, env, resetEmailEnabled: Boolean(sendMail) },
});

app.addHook("onClose", async () => { await database.$disconnect(); });

let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => process.exit(1), 10_000).unref();
    await app.close();
    clearTimeout(timeout);
  });
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch {
  app.log.error("Não foi possível iniciar a API.");
  await app.close();
  process.exitCode = 1;
}
