import { createDatabase } from "../../src/plugins/database.js";
import { createUser } from "../../src/modules/users/service.js";

if (process.env.VALIDATION_ONLY !== "true" || !process.env.VALIDATION_PASSWORD || !process.env.DATABASE_URL) {
  throw new Error("Fixture exclusiva do ambiente Docker de validação.");
}
const database = createDatabase(process.env.DATABASE_URL);
try {
  for (const [email, role] of [["admin@validation.invalid", "admin"], ["editor@validation.invalid", "editor"]] as const) {
    if (!await database.user.findUnique({ where: { email } })) {
      await createUser(database, { name: `Validação ${role}`, email, role, password: process.env.VALIDATION_PASSWORD });
    }
  }
  console.log("Contas fictícias do ensaio preparadas.");
} finally { await database.$disconnect(); }
