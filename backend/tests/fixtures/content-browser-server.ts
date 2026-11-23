// Servidor exclusivo do ensaio de navegador. Nunca registrar esta fixture no servidor real.
import { createApp } from "../../src/app.js";
import { readEnvironment } from "../../src/config/env.js";
import { createDatabase } from "../../src/plugins/database.js";
import { createAuth } from "../../src/modules/auth/auth.js";
import { createCalendarFixture } from "./calendar-provider.js";
const env = readEnvironment();
if (env.NODE_ENV !== "test" || !/^\/dra_auth_test_ui_[a-z0-9]+$/.test(new URL(env.DATABASE_URL).pathname)
  || !["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname) || env.PORT !== 3101) throw new Error("Fixture restrita ao ensaio local isolado.");
const database = createDatabase(env.DATABASE_URL);
const calendar = process.env.TEST_CALENDAR_BROWSER === "true" ? createCalendarFixture() : undefined;
if (calendar) {
  calendar.records.set("initialconsultation", { id: "initialconsultation", etag: '"initial1"', summary: "Consulta inicial fictícia", description: "Dados de teste.", start: { dateTime: "2030-03-04T12:00:00Z" }, end: { dateTime: "2030-03-04T13:00:00Z" }, recurringEventId: "fixtureseries" });
  calendar.records.set("alldayfixture", { id: "alldayfixture", etag: '"allday1"', summary: "Bloqueio de dia inteiro fictício", start: { date: "2030-03-05" }, end: { date: "2030-03-06" } });
  // Outra semana: exemplos exclusivos para validar a apresentação por horário.
  for (const [id, title, start, end, readonly] of [
    ["earlyfixture", "Horário cedo fictício", "00:30", "01:00", false],
    ["overlapfixturea", "Sobreposição visual A", "09:00", "10:00", true],
    ["overlapfixtureb", "Sobreposição visual B", "09:15", "10:15", true],
    ["latefixture", "Horário tarde fictício", "23:00", "23:30", false],
  ] as const) calendar.records.set(id, { id, etag: `"${id}1"`, summary: title,
    start: { dateTime: `2030-03-11T${start}:00-03:00` }, end: { dateTime: `2030-03-11T${end}:00-03:00` },
    ...(readonly ? { attendees: [{ email: "convidado-ficticio@example.invalid" }] } : {}),
  });
}
const app = createApp({ logger: false, checkDatabase: async () => { await database.$queryRaw`SELECT 1`; }, authServices: {
  database, env, auth: createAuth(database, env), resetEmailEnabled: false,
  calendarProvider: calendar?.provider,
  aiProvider: { model: "fixture-browser-no-external-ai", async generate(input) {
    return input.variations ? JSON.stringify({ suggestions: ["Sugestão fictícia editável para revisão humana."] }) : "Resposta gerada pela fixture local de teste, sem OpenAI real.";
  } },
} });
app.addHook("onClose", () => database.$disconnect());
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => { void app.close(); });
await app.listen({ host: "127.0.0.1", port: env.PORT });
