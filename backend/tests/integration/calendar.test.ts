import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import type { CalendarStatus } from "@dra/contracts";
import { createApp } from "../../src/app.js";
import { createAuth } from "../../src/modules/auth/auth.js";
import { readEnvironment } from "../../src/config/env.js";
import { createDatabase } from "../../src/plugins/database.js";
import { createUser, AccessError } from "../../src/modules/users/service.js";
import { createCalendarFixture } from "../fixtures/calendar-provider.js";
import { decryptToken, encryptToken } from "../../src/modules/calendar/crypto.js";
import { localToInstant } from "../../src/modules/calendar/time.js";
import { createGoogleCalendarProvider, CalendarAuthError } from "../../src/modules/calendar/google.js";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("Execute pnpm run test:integration na raiz.");
test("Google Agenda: OAuth, permissões, horários e operações com provedor isolado", async (t) => {
  assert.match(new URL(databaseURL).pathname, /^\/dra_auth_test_[a-z0-9_]+$/);
  const database = createDatabase(databaseURL);
  const env = readEnvironment({ DATABASE_URL: databaseURL, NODE_ENV: "test", BETTER_AUTH_SECRET: randomBytes(32).toString("hex"), GOOGLE_CALENDAR_CLIENT_ID: "fixture-client", GOOGLE_CALENDAR_CLIENT_SECRET: "fixture-secret", GOOGLE_CALENDAR_TOKEN_KEY: randomBytes(32).toString("hex") });
  const fixture = createCalendarFixture();
  const services = { auth: createAuth(database, env), database, env, resetEmailEnabled: false, calendarProvider: fixture.provider };
  const app = createApp({ logger: false, checkDatabase: async () => {}, authServices: services });
  const unconfigured = createApp({ logger: false, checkDatabase: async () => {}, authServices: { ...services, env: { ...env, GOOGLE_CALENDAR_CLIENT_ID: undefined }, calendarProvider: undefined } });
  t.after(async () => { await app.close(); await unconfigured.close(); await database.calendarOAuthState.deleteMany(); await database.calendarConnection.deleteMany(); await database.$disconnect(); });
  const password = randomBytes(24).toString("hex");
  const admin = await createUser(database, { name: "Admin agenda", email: "agenda-admin@example.invalid", password, role: "admin" });
  const editor = await createUser(database, { name: "Editor agenda", email: "agenda-editor@example.invalid", password, role: "editor" });
  const otherAdmin = await createUser(database, { name: "Outra admin agenda", email: "agenda-other@example.invalid", password, role: "admin" });
  async function login(email: string, ip: string) {
    const result = await app.inject({ method: "POST", url: "/api/v1/auth/sign-in/email", payload: { email, password }, headers: { origin: env.APP_ORIGIN }, remoteAddress: ip }); assert.equal(result.statusCode, 200);
    const raw = result.headers["set-cookie"]; return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((value) => value.split(";")[0]).join("; ");
  }
  const cookie = await login(admin.email, "198.51.100.140"), editorCookie = await login(editor.email, "198.51.100.141"), otherCookie = await login(otherAdmin.email, "198.51.100.142");
  const request = (method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, payload?: object, who = cookie) => app.inject({ method, url: `/api/v1/calendar${path}`, headers: { origin: env.APP_ORIGIN, cookie: who }, ...(payload ? { payload } : {}) });
  const status = async () => (await request("GET", "/status")).json<CalendarStatus>();
  const version = async () => { const value = await status(); return { connectionRevision: value.revision, connectionGeneration: value.generation }; };
  const connect = async () => { const result = await request("POST", "/connect", {}); assert.equal(result.statusCode, 200); const url = new URL(result.json().authorizationUrl); return url.searchParams.get("state")!; };
  const callback = (state: string, code = "fixture-code", who = cookie) => request("GET", `/oauth/callback?${new URLSearchParams({ state, code })}`, undefined, who);
  const data = { title: "Consulta fictícia de teste", notes: "Somente teste administrativo.", startLocal: "2030-03-04T09:00", endLocal: "2030-03-04T10:00" };
  let eventId = "";

  await t.test("agenda é exclusiva de admin; mutações exigem origem e JSON", async () => {
    const paths = [["GET", "/status", undefined], ["POST", "/connect", {}], ["GET", "/calendars", undefined], ["PUT", "/selection", {}], ["GET", "/events", undefined], ["POST", "/events", {}], ["PATCH", "/events/fakeid", {}], ["DELETE", "/events/fakeid", {}], ["POST", "/disconnect", {}]] as const;
    for (const [method, path, payload] of paths) { assert.equal((await request(method, path, payload, "")).statusCode, 401); assert.equal((await request(method, path, payload, editorCookie)).statusCode, 403); }
    assert.equal((await app.inject({ method: "POST", url: "/api/v1/calendar/connect", payload: {}, headers: { cookie, origin: "https://hostile.invalid" } })).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: "/api/v1/calendar/connect", payload: "{}", headers: { cookie, origin: env.APP_ORIGIN, "content-type": "text/plain" } })).statusCode, 415);
  });
  await t.test("sem credenciais não simula conexão; status não cria registros ou expõe segredos", async () => {
    const result = await unconfigured.inject({ url: "/api/v1/calendar/status", headers: { cookie } }); assert.equal(result.statusCode, 200); assert.equal(result.json().configured, false); assert.equal(result.json().connected, false);
    assert.equal(await database.calendarConnection.count(), 0);
    assert.equal((await unconfigured.inject({ method: "POST", url: "/api/v1/calendar/connect", payload: {}, headers: { cookie, origin: env.APP_ORIGIN } })).statusCode, 503);
    assert.ok(!result.body.includes("fixture-secret"));
  });
  await t.test("OAuth usa PKCE, state de uso único/expirável e vinculação à administradora", async () => {
    const state = await connect();
    const stored = await database.calendarOAuthState.findUniqueOrThrow({ where: { userId: admin.id } });
    assert.notEqual(stored.stateHash, state); assert.match(stored.verifierCipher, /^v1\./); assert.ok(!stored.verifierCipher.includes("fixture"));
    assert.equal((await callback(state, "fixture-code", otherCookie)).statusCode, 400);
    const denied = await request("GET", `/oauth/callback?state=${state}&error=access_denied`); assert.match(String(denied.headers.location), /connection=denied/); assert.equal(fixture.controls.exchanged, 0);
    assert.equal((await callback(state)).statusCode, 400);
    const expired = await connect(); await database.calendarOAuthState.update({ where: { userId: admin.id }, data: { expiresAt: new Date(Date.now() - 1000) } }); assert.equal((await callback(expired)).statusCode, 400);
  });
  await t.test("conectar cifra refresh token; escolher agenda valida permissão e revisão", async () => {
    const result = await callback(await connect()); assert.match(String(result.headers.location), /connection=connected/);
    const connection = await database.calendarConnection.findUniqueOrThrow({ where: { id: "clinic" } });
    assert.notEqual(connection.refreshTokenCipher, "fixture-refresh-token-only-for-tests"); assert.equal(decryptToken(connection.refreshTokenCipher, env.GOOGLE_CALENDAR_TOKEN_KEY!), "fixture-refresh-token-only-for-tests");
    const value = await status(); assert.equal(value.connected, true); assert.equal(value.calendar, null); assert.ok(!JSON.stringify(value).includes("Token"));
    assert.equal((await request("GET", "/calendars")).json().items[0].name, fixture.choice.name);
    assert.equal((await request("PUT", "/selection", { ...await version(), calendarId: "unauthorized" })).statusCode, 403);
    const old = await version(); assert.equal((await request("PUT", "/selection", { ...old, calendarId: fixture.choice.id })).statusCode, 200);
    assert.equal((await request("PUT", "/selection", { ...old, calendarId: fixture.choice.id })).statusCode, 409);
  });
  await t.test("conversão de fuso valida datas, horários inexistentes e ambíguos", () => {
    assert.equal(localToInstant("2030-03-04T09:00", "America/Sao_Paulo").toISOString(), "2030-03-04T12:00:00.000Z");
    for (const [date, zone] of [["2030-02-30T09:00", "America/Sao_Paulo"], ["2030-03-10T02:30", "America/New_York"], ["2030-11-03T01:30", "America/New_York"], ["2030-03-04T09:00", "Invalid/Zone"]]) assert.throws(() => localToInstant(date, zone), AccessError);
  });
  await t.test("criação persiste no provedor e é idempotente; retry com corpo diferente é rejeitado", async () => {
    const input = { ...data, ...await version(), requestId: randomUUID() };
    const result = await request("POST", "/events", input); assert.equal(result.statusCode, 201); eventId = result.json().event.id;
    assert.equal(result.json().event.start, "2030-03-04T12:00:00.000Z"); assert.equal(fixture.controls.inserted, 1);
    assert.equal((await request("POST", "/events", input)).json().event.id, eventId); assert.equal(fixture.controls.inserted, 1);
    assert.equal((await request("POST", "/events", { ...input, title: "Outro texto fictício" })).statusCode, 409);
  });
  await t.test("recupera criação após timeout sem duplicação; campos inválidos não são enviados", async () => {
    const input = { ...data, startLocal: "2030-03-04T11:00", endLocal: "2030-03-04T12:00", ...await version(), requestId: randomUUID() };
    fixture.controls.failAfterInsert = true; assert.equal((await request("POST", "/events", input)).statusCode, 503);
    const before = fixture.controls.inserted; assert.equal((await request("POST", "/events", input)).statusCode, 201); assert.equal(fixture.controls.inserted, before);
    assert.equal((await request("POST", "/events", { ...input, requestId: randomUUID(), endLocal: "2030-03-04T08:00" })).statusCode, 400);
    assert.equal((await request("POST", "/events", { ...input, requestId: randomUUID(), attendees: ["nobody@example.invalid"] })).statusCode, 400);
  });
  await t.test("bloqueia sobreposição e cria apenas uma consulta em solicitações concorrentes", async () => {
    assert.equal((await request("POST", "/events", { ...data, ...await version(), requestId: randomUUID() })).statusCode, 409);
    const source = { ...data, startLocal: "2030-03-04T14:00", endLocal: "2030-03-04T15:00", ...await version() };
    const results = await Promise.all([1, 2].map(() => request("POST", "/events", { ...source, requestId: randomUUID() })));
    assert.deepEqual(results.map((item) => item.statusCode).sort(), [201, 409]);
  });
  await t.test("listagem usa Google como referência, período limitado e eventos de dia inteiro bloqueiam horários", async () => {
    fixture.records.set("allday", { id: "allday", etag: '"all1"', summary: "Bloqueio fictício", start: { date: "2030-03-05" }, end: { date: "2030-03-06" } });
    const current = await version();
    const query = new URLSearchParams({ from: "2030-03-04", to: "2030-03-11", connectionRevision: String(current.connectionRevision), connectionGeneration: current.connectionGeneration! });
    const result = await request("GET", `/events?${query}`); assert.equal(result.statusCode, 200); assert.equal(result.json().timeZone, "America/Sao_Paulo"); assert.equal(result.json().items.find((item: { id: string }) => item.id === "allday").editable, false);
    assert.equal((await request("POST", "/events", { ...data, startLocal: "2030-03-05T09:00", endLocal: "2030-03-05T10:00", ...await version(), requestId: randomUUID() })).statusCode, 409);
    query.set("to", "2031-03-01"); assert.equal((await request("GET", `/events?${query}`)).statusCode, 400);
  });
  await t.test("edição exige etag atual; eventos com convidados não são alterados", async () => {
    const source = fixture.records.get(eventId)!;
    assert.equal((await request("PATCH", `/events/${eventId}`, { ...data, ...await version(), etag: '"stale"' })).statusCode, 409);
    const result = await request("PATCH", `/events/${eventId}`, { ...data, startLocal: "2030-03-04T08:00", endLocal: "2030-03-04T09:00", ...await version(), etag: source.etag });
    assert.equal(result.statusCode, 200); assert.equal(result.json().event.start, "2030-03-04T11:00:00.000Z");
    fixture.records.set("guests", { ...source, id: "guests", etag: '"guest1"', attendees: [{ email: "guest@example.invalid" }] });
    assert.equal((await request("PATCH", "/events/guests", { ...data, ...await version(), etag: '"guest1"' })).statusCode, 409);
    assert.equal((await request("DELETE", "/events/guests", { ...await version(), etag: '"guest1"', confirmCancellation: true })).statusCode, 409);
  });
  await t.test("cancelamento exige confirmação/etag e preserva os demais eventos", async () => {
    const etag = fixture.records.get(eventId)!.etag, before = fixture.records.size;
    assert.equal((await request("DELETE", `/events/${eventId}`, { ...await version(), etag, confirmCancellation: false })).statusCode, 400);
    assert.equal((await request("DELETE", `/events/${eventId}`, { ...await version(), etag, confirmCancellation: true })).statusCode, 200);
    assert.equal(fixture.records.size, before - 1); assert.ok(!fixture.records.has(eventId));
  });
  await t.test("acesso revogado sinaliza reconexão; reautorizar não altera eventos", async () => {
    fixture.controls.expired = true; assert.equal((await request("GET", "/calendars")).statusCode, 409); assert.equal((await status()).needsReconnect, true);
    const size = fixture.records.size; fixture.controls.expired = false;
    assert.match(String((await callback(await connect())).headers.location), /connection=connected/); assert.equal((await status()).needsReconnect, false); assert.equal(fixture.records.size, size);
    assert.equal((await request("PUT", "/selection", { ...await version(), calendarId: fixture.choice.id })).statusCode, 200);
  });
  await t.test("desconectar apaga credencial local, tenta revogar sem apagar eventos e rejeita geração antiga", async () => {
    const old = await version(), size = fixture.records.size; fixture.controls.revokedResult = false;
    const result = await request("POST", "/disconnect", old); assert.equal(result.statusCode, 200); assert.equal(result.json().revoked, false); assert.equal(fixture.controls.revoked, true); assert.equal(await database.calendarConnection.count(), 0); assert.equal(fixture.records.size, size);
    await callback(await connect()); await request("PUT", "/selection", { ...await version(), calendarId: fixture.choice.id });
    assert.equal((await request("POST", "/events", { ...data, ...old, requestId: randomUUID() })).statusCode, 409);
  });
  await t.test("falha OAuth preserva conexão anterior; bloquear admin encerra acesso à agenda", async () => {
    const before = await database.calendarConnection.findUniqueOrThrow({ where: { id: "clinic" } });
    assert.match(String((await callback(await connect(), "invalid-code")).headers.location), /connection=failed/);
    assert.deepEqual(await database.calendarConnection.findUniqueOrThrow({ where: { id: "clinic" } }), before);
    await database.user.update({ where: { id: admin.id }, data: { disabled: true } });
    assert.equal((await request("GET", "/status")).statusCode, 401);
  });
  await t.test("cifra autenticada rejeita adulteração/chave errada; configuração não imprime chaves", () => {
    const key = env.GOOGLE_CALENDAR_TOKEN_KEY!, token = encryptToken("fixture-credential", key);
    assert.equal(decryptToken(token, key), "fixture-credential"); assert.throws(() => decryptToken(token, randomBytes(32).toString("hex")), AccessError);
    assert.throws(() => readEnvironment({ ...process.env, DATABASE_URL: databaseURL, BETTER_AUTH_SECRET: randomBytes(32).toString("hex"), GOOGLE_CALENDAR_TOKEN_KEY: "invalid-secret-not-to-print" }), (error: unknown) => error instanceof Error && !error.message.includes("invalid-secret"));
  });
  await t.test("adaptador HTTP fixa endpoints, codifica IDs, pagina e envia If-Match sem convites", async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const transport = (async (url, init) => {
      requests.push({ url: String(url), init });
      if (String(url).includes("oauth2.googleapis.com/token")) return Response.json({ access_token: "fake-access", expires_in: 3600, refresh_token: "fake-refresh", scope: "openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events" });
      if (String(url).includes("openidconnect.googleapis.com")) return Response.json({ sub: "fixture-sub", email: "fixture@example.invalid", email_verified: true });
      if (String(url).includes("calendarList")) return Response.json({ items: [{ id: "id/@", summary: "Agenda fictícia", accessRole: "writer", timeZone: "America/Sao_Paulo" }] });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      const event = { id: "eventid", etag: '"etag"', start: { dateTime: "2030-03-04T12:00:00Z" }, end: { dateTime: "2030-03-04T13:00:00Z" } };
      if (!init?.method) return new URL(String(url)).searchParams.has("pageToken") ? Response.json({ items: [] }) : Response.json({ items: [event], nextPageToken: "fixture-next-page" });
      return Response.json(event);
    }) as typeof fetch;
    const provider = createGoogleCalendarProvider("fake-client", "fake-secret", transport);
    assert.equal((await provider.exchange("fake-code", "fake-verifier", "http://localhost:3000/api/v1/calendar/oauth/callback")).email, "fixture@example.invalid");
    assert.equal((await provider.refresh("fake-refresh")).accessToken, "fake-access"); assert.equal((await provider.calendars("token")).length, 1);
    await provider.events("token", "id/@", "2030-03-04T00:00:00Z", "2030-03-05T00:00:00Z");
    assert.ok(requests.some((item) => item.url.includes("pageToken=fixture-next-page")));
    const body = { summary: "Fictício", description: "", start: { dateTime: "2030-03-04T12:00:00Z", timeZone: "America/Sao_Paulo" }, end: { dateTime: "2030-03-04T13:00:00Z", timeZone: "America/Sao_Paulo" } };
    await provider.update("token", "id/@", "eventid", '"etag"', body); await provider.remove("token", "id/@", "eventid", '"etag"');
    assert.ok(requests.some((item) => item.url.includes("id%2F%40")));
    for (const item of requests.filter((item) => ["PATCH", "DELETE"].includes(item.init?.method ?? ""))) { assert.equal((item.init?.headers as Record<string, string>)["If-Match"], '"etag"'); assert.ok(item.url.includes("sendUpdates=none")); }
    const revoked = createGoogleCalendarProvider("fake-client", "fake-secret", (async () => Response.json({ error: "invalid_grant" }, { status: 400 })) as typeof fetch);
    await assert.rejects(revoked.refresh("fake-refresh"), CalendarAuthError);
    const limited = createGoogleCalendarProvider("fake-client", "fake-secret", (async () => new Response("", { status: 429 })) as typeof fetch);
    await assert.rejects(limited.calendars("fake-access"), (error: unknown) => error instanceof AccessError && error.statusCode === 429);
    const failure = createGoogleCalendarProvider("fake-client", "fake-secret", (async () => { throw new Error("private-token-not-to-print"); }) as typeof fetch);
    await assert.rejects(failure.refresh("fake-refresh"), (error: unknown) => error instanceof AccessError && !error.message.includes("private-token"));
  });
});
