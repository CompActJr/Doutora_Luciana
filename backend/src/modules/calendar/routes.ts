import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { CalendarStatus } from "@dra/contracts";
import type { Environment } from "../../config/env.js";
import type { createDatabase } from "../../plugins/database.js";
import type { CalendarConnection, Prisma } from "../../generated/prisma/client.js";
import { AccessError } from "../users/service.js";
import { contentRevision, parseContent } from "../content/validation.js";
import { encryptToken, decryptToken } from "./crypto.js";
import { CalendarAuthError, calendarScopes, publicAppointment, type GoogleCalendarProvider, type GoogleEventBody } from "./google.js";
import { localToInstant } from "./time.js";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const appointmentInput = z.strictObject({ title: z.string().trim().min(3).max(120), notes: z.string().trim().max(2000), startLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), endLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/) });
const eventParams = z.strictObject({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,1024}$/) });
const versionInput = { connectionRevision: contentRevision, connectionGeneration: z.uuid() };
type Services = { database: ReturnType<typeof createDatabase>; env: Environment; currentUser: (request: FastifyRequest, admin?: boolean) => Promise<{ id: string }>; provider?: GoogleCalendarProvider };

export async function registerCalendarRoutes(app: FastifyInstance, { database, env, currentUser, provider }: Services) {
  const redirectUri = `${env.APP_ORIGIN}/api/v1/calendar/oauth/callback`;
  const configured = Boolean(provider && env.GOOGLE_CALENDAR_CLIENT_ID && env.GOOGLE_CALENDAR_CLIENT_SECRET && env.GOOGLE_CALENDAR_TOKEN_KEY);
  const requireConfig = () => { if (!configured || !provider) throw new AccessError(503, "Configure o aplicativo Google Agenda no servidor para conectar sua conta."); return provider; };
  const lock = (tx: Prisma.TransactionClient) => tx.$queryRaw`SELECT pg_advisory_xact_lock(773946201)::text`;
  const selected = (connection: CalendarConnection | null, revision: number, generation: string): CalendarConnection & { calendarId: string } => {
    if (!connection || connection.needsReconnect) throw new AccessError(409, "Conecte ou reconecte sua conta Google.");
    if (!connection.calendarId) throw new AccessError(409, "Selecione uma agenda para continuar.");
    if (revision !== connection.revision || generation !== connection.generation) throw new AccessError(409, "A conexão ou agenda selecionada mudou. Atualize antes de continuar.");
    return connection as CalendarConnection & { calendarId: string };
  };
  async function access(connection: CalendarConnection) {
    const google = requireConfig();
    if (connection.needsReconnect) throw new CalendarAuthError();
    return (await google.refresh(decryptToken(connection.refreshTokenCipher, env.GOOGLE_CALENDAR_TOKEN_KEY!))).accessToken;
  }
  async function protect<T>(run: () => Promise<T>): Promise<T> {
    try { return await run(); }
    catch (error) {
      if (error instanceof CalendarAuthError) {
        // Só sinalizar a geração que falhou, sem invalidar uma conexão nova.
        throw error;
      }
      if (error && typeof error === "object" && "code" in error && ["P2002", "P2034", "P2028"].includes(String(error.code))) throw new AccessError(409, "Outra operação de agenda está em andamento. Atualize e tente novamente.");
      throw error;
    }
  }
  async function withConnection<T>(revision: number, expectedGeneration: string, run: (connection: CalendarConnection & { calendarId: string }, token: string, google: GoogleCalendarProvider) => Promise<T>): Promise<T> {
    let generation: string | undefined;
    try {
      return await protect(() => database.$transaction(async (tx) => {
        await lock(tx);
        const connection = selected(await tx.calendarConnection.findUnique({ where: { id: "clinic" } }), revision, expectedGeneration);
        generation = connection.generation;
        return run(connection, await access(connection), requireConfig());
      }, { maxWait: 10000, timeout: 60000 }));
    } catch (error) {
      if (error instanceof CalendarAuthError && generation) await database.calendarConnection.updateMany({ where: { id: "clinic", generation }, data: { needsReconnect: true } });
      throw error;
    }
  }
  async function withAccount<T>(run: (connection: CalendarConnection, token: string, google: GoogleCalendarProvider) => Promise<T>) {
    requireConfig();
    const connection = await database.calendarConnection.findUnique({ where: { id: "clinic" } });
    if (!connection) throw new AccessError(409, "Conecte sua conta Google.");
    try { return await run(connection, await access(connection), requireConfig()); }
    catch (error) { if (error instanceof CalendarAuthError) await database.calendarConnection.updateMany({ where: { id: "clinic", generation: connection.generation }, data: { needsReconnect: true } }); throw error; }
  }
  app.get("/api/v1/calendar/status", async (request): Promise<CalendarStatus> => {
    await currentUser(request, true);
    const connection = await database.calendarConnection.findUnique({ where: { id: "clinic" } });
    return { configured, connected: Boolean(connection), needsReconnect: Boolean(connection?.needsReconnect), email: connection?.email ?? null, revision: connection?.revision ?? 0, generation: connection?.generation ?? null, redirectUri,
      calendar: connection?.calendarId ? { id: connection.calendarId, name: connection.calendarName ?? "Agenda da clínica", timeZone: connection.timeZone, primary: false } : null };
  });
  app.post("/api/v1/calendar/connect", async (request) => {
    const actor = await currentUser(request, true); requireConfig();
    parseContent(z.strictObject({}), request.body);
    const state = randomBytes(32).toString("base64url"), verifier = randomBytes(48).toString("base64url");
    await database.$transaction(async (tx) => {
      await lock(tx);
      await tx.calendarOAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      const connection = await tx.calendarConnection.findUnique({ where: { id: "clinic" } });
      const data = { stateHash: digest(state), userId: actor.id, verifierCipher: encryptToken(verifier, env.GOOGLE_CALENDAR_TOKEN_KEY!), expectedRevision: connection?.revision ?? 0, expectedGeneration: connection?.generation ?? null, expiresAt: new Date(Date.now() + 10 * 60000) };
      await tx.calendarOAuthState.deleteMany({ where: { userId: actor.id } });
      await tx.calendarOAuthState.create({ data });
    });
    const query = new URLSearchParams({ client_id: env.GOOGLE_CALENDAR_CLIENT_ID!, redirect_uri: redirectUri, response_type: "code", scope: calendarScopes.join(" "), access_type: "offline", prompt: "consent select_account", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
    return { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${query}` };
  });
  app.get("/api/v1/calendar/oauth/callback", async (request, reply) => {
    const actor = await currentUser(request, true); const google = requireConfig();
    reply.header("Referrer-Policy", "no-referrer");
    const query = parseContent(z.object({ state: z.string().min(20).max(128), code: z.string().max(4096).optional(), error: z.string().max(200).optional() }), request.query);
    const state = await database.$transaction(async (tx) => {
      await lock(tx);
      const value = await tx.calendarOAuthState.findUnique({ where: { stateHash: digest(query.state) } });
      if (!value || value.userId !== actor.id || value.expiresAt <= new Date()) throw new AccessError(400, "Autorização inválida ou expirada. Inicie a conexão novamente.");
      await tx.calendarOAuthState.delete({ where: { stateHash: value.stateHash } }); return value;
    });
    if (query.error || !query.code) return reply.redirect(`${env.APP_ORIGIN}/agenda?connection=denied`);
    try {
      const identity = await google.exchange(query.code, decryptToken(state.verifierCipher, env.GOOGLE_CALENDAR_TOKEN_KEY!), redirectUri);
      // Sessão e perfil ainda precisam estar válidos após a operação externa.
      await currentUser(request, true);
      await protect(() => database.$transaction(async (tx) => {
        await lock(tx);
        const existing = await tx.calendarConnection.findUnique({ where: { id: "clinic" } });
        if ((existing?.revision ?? 0) !== state.expectedRevision || (existing?.generation ?? null) !== state.expectedGeneration) throw new AccessError(409, "A conexão mudou. Inicie novamente.");
        const data = { generation: randomUUID(), email: identity.email, refreshTokenCipher: encryptToken(identity.refreshToken, env.GOOGLE_CALENDAR_TOKEN_KEY!), calendarId: null, calendarName: null, timeZone: "America/Sao_Paulo", needsReconnect: false, connectedBy: actor.id, connectedAt: new Date() };
        await tx.calendarConnection.upsert({ where: { id: "clinic" }, create: { ...data, id: "clinic" }, update: { ...data, revision: { increment: 1 } } });
      }));
      return reply.redirect(`${env.APP_ORIGIN}/agenda?connection=connected`);
    } catch { return reply.redirect(`${env.APP_ORIGIN}/agenda?connection=failed`); }
  });
  app.get("/api/v1/calendar/calendars", async (request) => {
    await currentUser(request, true);
    return { items: await withAccount((_connection, token, google) => google.calendars(token)) };
  });
  app.put("/api/v1/calendar/selection", async (request) => {
    await currentUser(request, true);
    const input = parseContent(z.strictObject({ calendarId: z.string().min(1).max(1024), ...versionInput }), request.body);
    return protect(() => database.$transaction(async (tx) => {
      await lock(tx); requireConfig();
      const connection = await tx.calendarConnection.findUnique({ where: { id: "clinic" } });
      if (!connection || connection.revision !== input.connectionRevision || connection.generation !== input.connectionGeneration || connection.needsReconnect) throw new AccessError(409, "A conexão mudou ou precisa ser refeita. Atualize.");
      const calendar = await requireConfig().calendar(await access(connection), input.calendarId);
      await tx.calendarConnection.update({ where: { id: "clinic" }, data: { calendarId: calendar.id, calendarName: calendar.name, timeZone: calendar.timeZone, revision: { increment: 1 } } });
      return { success: true };
    }, { maxWait: 10000, timeout: 45000 }));
  });
  app.post("/api/v1/calendar/disconnect", async (request) => {
    await currentUser(request, true);
    const input = parseContent(z.strictObject({ ...versionInput }), request.body);
    const secret = await database.$transaction(async (tx) => {
      await lock(tx);
      const connection = await tx.calendarConnection.findUnique({ where: { id: "clinic" } });
      if (!connection || connection.revision !== input.connectionRevision || connection.generation !== input.connectionGeneration) throw new AccessError(409, "A conexão mudou. Atualize.");
      await tx.calendarOAuthState.deleteMany();
      await tx.calendarConnection.delete({ where: { id: "clinic" } });
      return connection.refreshTokenCipher;
    });
    let revoked = false;
    if (configured) { try { revoked = await requireConfig().revoke(decryptToken(secret, env.GOOGLE_CALENDAR_TOKEN_KEY!)); } catch {} }
    return { success: true, revoked };
  });
  app.get("/api/v1/calendar/events", async (request) => {
    await currentUser(request, true);
    const input = parseContent(z.strictObject({ from: z.iso.date(), to: z.iso.date(), connectionRevision: z.coerce.number().int().min(1), connectionGeneration: z.uuid() }), request.query);
    return withConnection(input.connectionRevision, input.connectionGeneration, async (connection, token, google) => {
      const start = localToInstant(`${input.from}T00:00`, connection.timeZone), end = localToInstant(`${input.to}T00:00`, connection.timeZone);
      if (end <= start || end.getTime() - start.getTime() > 43 * 86400000) throw new AccessError(400, "Selecione um período de até 42 dias.");
      const items = (await google.events(token, connection.calendarId, start.toISOString(), end.toISOString())).map(publicAppointment);
      return { items, timeZone: connection.timeZone, calendarId: connection.calendarId, connectionRevision: connection.revision, fetchedAt: new Date().toISOString() };
    });
  });
  function eventBody(input: z.infer<typeof appointmentInput>, zone: string): GoogleEventBody {
    const start = localToInstant(input.startLocal, zone), end = localToInstant(input.endLocal, zone);
    if (end <= start || end.getTime() - start.getTime() > 12 * 3600000) throw new AccessError(400, "A consulta precisa terminar após o início e durar até 12 horas.");
    return { summary: input.title, description: input.notes, start: { dateTime: start.toISOString(), timeZone: zone }, end: { dateTime: end.toISOString(), timeZone: zone } };
  }
  async function checkOverlap(google: GoogleCalendarProvider, token: string, calendarId: string, body: GoogleEventBody, except?: string) {
    const events = await google.events(token, calendarId, body.start.dateTime, body.end.dateTime);
    if (events.some((event) => event.id !== except && event.transparency !== "transparent" && event.status !== "cancelled")) throw new AccessError(409, "Já existe um compromisso nesse intervalo. Atualize e escolha outro horário.");
  }
  app.post("/api/v1/calendar/events", async (request, reply) => {
    await currentUser(request, true);
    const input = parseContent(appointmentInput.extend({ ...versionInput, requestId: z.uuid() }), request.body);
    const event = await withConnection(input.connectionRevision, input.connectionGeneration, async (connection, token, google) => {
      const body = eventBody(input, connection.timeZone);
      const hash = digest(JSON.stringify(body));
      const id = digest(`${connection.generation}:${connection.calendarId}:${input.requestId}`);
      // ID determinístico permite recuperar uma criação após timeout, sem duplicá-la.
      try {
        const existing = await google.event(token, connection.calendarId, id);
        if (existing.extendedProperties?.private?.draPayloadHash !== hash) throw new AccessError(409, "Esta tentativa já foi usada com outro conteúdo. Atualize a agenda.");
        return publicAppointment(existing);
      } catch (error) { if (!(error instanceof AccessError && error.statusCode === 404)) throw error; }
      await checkOverlap(google, token, connection.calendarId, body);
      return publicAppointment(await google.insert(token, connection.calendarId, { ...body, id, extendedProperties: { private: { draPayloadHash: hash } } }));
    });
    return reply.code(201).send({ event });
  });
  app.patch("/api/v1/calendar/events/:id", async (request) => {
    await currentUser(request, true);
    const { id } = parseContent(eventParams, request.params);
    const input = parseContent(appointmentInput.extend({ ...versionInput, etag: z.string().min(1).max(500) }), request.body);
    return withConnection(input.connectionRevision, input.connectionGeneration, async (connection, token, google) => {
      const source = await google.event(token, connection.calendarId, id);
      if (!publicAppointment(source).editable) throw new AccessError(409, "Este tipo de evento deve ser editado no Google Agenda.");
      if (source.etag !== input.etag) throw new AccessError(409, "O evento mudou no Google. Atualize antes de editar.");
      const body = eventBody(input, connection.timeZone);
      await checkOverlap(google, token, connection.calendarId, body, id);
      return { event: publicAppointment(await google.update(token, connection.calendarId, id, input.etag, body)) };
    });
  });
  app.delete("/api/v1/calendar/events/:id", async (request) => {
    await currentUser(request, true);
    const { id } = parseContent(eventParams, request.params);
    const input = parseContent(z.strictObject({ ...versionInput, etag: z.string().min(1).max(500), confirmCancellation: z.literal(true) }), request.body);
    return withConnection(input.connectionRevision, input.connectionGeneration, async (connection, token, google) => {
      const source = await google.event(token, connection.calendarId, id);
      if (!publicAppointment(source).editable) throw new AccessError(409, "Este tipo de evento deve ser cancelado no Google Agenda.");
      if (source.etag !== input.etag) throw new AccessError(409, "O evento mudou no Google. Atualize antes de cancelar.");
      await google.remove(token, connection.calendarId, id, input.etag);
      return { success: true };
    });
  });
}
