import { z } from "zod";
import type { Appointment, CalendarChoice } from "@dra/contracts";
import { AccessError } from "../users/service.js";
import { validTimeZone } from "./time.js";

export const calendarScopes = ["openid", "email", "https://www.googleapis.com/auth/calendar.calendarlist.readonly", "https://www.googleapis.com/auth/calendar.events"];
const choiceSchema = z.object({ id: z.string(), summary: z.string(), timeZone: z.string(), accessRole: z.string(), primary: z.boolean().optional() });
const point = z.object({ dateTime: z.string().optional(), date: z.string().optional() });
export const googleEventSchema = z.object({ id: z.string(), etag: z.string(), summary: z.string().optional(), description: z.string().optional(), start: point, end: point,
  status: z.string().optional(), transparency: z.string().optional(), recurringEventId: z.string().optional(), eventType: z.string().optional(), locked: z.boolean().optional(),
  attendees: z.array(z.object({ email: z.string().optional() })).optional(), extendedProperties: z.object({ private: z.record(z.string(), z.string()).optional() }).optional(),
});
export type GoogleEvent = z.infer<typeof googleEventSchema>;
export type GoogleEventBody = { id?: string; summary: string; description: string; start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string }; extendedProperties?: { private: Record<string, string> } };
export type GoogleCalendarProvider = {
  exchange: (code: string, verifier: string, redirectUri: string) => Promise<{ refreshToken: string; email: string }>;
  refresh: (refreshToken: string) => Promise<{ accessToken: string; expiresIn: number }>;
  revoke: (refreshToken: string) => Promise<boolean>;
  calendars: (token: string) => Promise<CalendarChoice[]>;
  calendar: (token: string, id: string) => Promise<CalendarChoice>;
  events: (token: string, id: string, start: string, end: string) => Promise<GoogleEvent[]>;
  event: (token: string, calendarId: string, id: string) => Promise<GoogleEvent>;
  insert: (token: string, id: string, input: GoogleEventBody) => Promise<GoogleEvent>;
  update: (token: string, calendarId: string, id: string, etag: string, input: GoogleEventBody) => Promise<GoogleEvent>;
  remove: (token: string, calendarId: string, id: string, etag: string) => Promise<void>;
};
export class CalendarAuthError extends AccessError {
  constructor() { super(409, "O acesso ao Google expirou ou foi revogado. Reconecte a conta."); }
}
export function publicAppointment(event: GoogleEvent): Appointment {
  return { id: event.id, etag: event.etag, title: event.summary || "Ocupado", notes: event.description || "", start: event.start.dateTime ?? event.start.date ?? "", end: event.end.dateTime ?? event.end.date ?? "", allDay: Boolean(event.start.date), recurring: Boolean(event.recurringEventId), transparent: event.transparency === "transparent",
    editable: Boolean(event.start.dateTime && event.end.dateTime) && !event.locked && !(event.attendees?.length) && (!event.eventType || event.eventType === "default") && (event.description?.length ?? 0) <= 2000 && (event.summary?.length ?? 0) <= 120 };
}
export function createGoogleCalendarProvider(clientId: string, clientSecret: string, transport: typeof fetch = fetch): GoogleCalendarProvider {
  async function response(url: string, options: RequestInit = {}) {
    try {
      const result = await transport(url, { ...options, redirect: "error", signal: AbortSignal.timeout(15_000) });
      if (result.ok) return result;
      if (result.status === 401) throw new CalendarAuthError();
      if (result.status === 400 && url === "https://oauth2.googleapis.com/token") {
        const payload = await result.json() as { error?: string };
        if (payload.error === "invalid_grant") throw new CalendarAuthError();
      }
      if (result.status === 403) throw new AccessError(403, "A conta não tem permissão para acessar ou alterar esta agenda. Confira as permissões no Google.");
      if ([404, 410].includes(result.status)) throw new AccessError(404, "Evento ou agenda não encontrado no Google. Atualize a agenda.");
      if ([409, 412].includes(result.status)) throw new AccessError(409, "O evento foi alterado no Google ou a operação já existe. Atualize a agenda antes de continuar.");
      if (result.status === 429) throw new AccessError(429, "O Google limitou as solicitações. Aguarde antes de atualizar a agenda.");
      throw new Error("google");
    } catch (error) {
      if (error instanceof AccessError) throw error;
      throw new AccessError(503, "Não foi possível confirmar a operação no Google. Atualize a agenda antes de tentar novamente.");
    }
  }
  async function json(url: string, options: RequestInit = {}): Promise<unknown> {
    try { return await (await response(url, options)).json(); }
    catch (error) { if (error instanceof AccessError) throw error; throw new AccessError(503, "O Google retornou uma resposta inválida."); }
  }
  const tokenRequest = (data: Record<string, string>) => json("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...data }).toString() });
  const headers = (token: string) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
  const base = "https://www.googleapis.com/calendar/v3";
  const path = (calendarId: string, id?: string) => `${base}/calendars/${encodeURIComponent(calendarId)}/events${id ? `/${encodeURIComponent(id)}` : ""}`;
  function choice(value: z.infer<typeof choiceSchema>): CalendarChoice {
    if (!["writer", "owner"].includes(value.accessRole)) throw new AccessError(403, "Selecione uma agenda com permissão de edição.");
    if (!validTimeZone(value.timeZone)) throw new AccessError(409, "O fuso desta agenda não é suportado. Ajuste no Google Agenda.");
    return { id: value.id, name: value.summary, timeZone: value.timeZone, primary: Boolean(value.primary) };
  }
  return {
    async exchange(code, verifier, redirectUri) {
      const value = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1), scope: z.string() }).parse(await tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri }));
      const granted = new Set(value.scope.split(" "));
      if (!calendarScopes.slice(2).every((scope) => granted.has(scope))) throw new AccessError(403, "Autorize as permissões de agenda solicitadas para concluir a conexão.");
      const identity = z.object({ sub: z.string(), email: z.email(), email_verified: z.literal(true) }).parse(await json("https://openidconnect.googleapis.com/v1/userinfo", { headers: headers(value.access_token) }));
      return { refreshToken: value.refresh_token, email: identity.email };
    },
    async refresh(refreshToken) {
      const value = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }).parse(await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }));
      return { accessToken: value.access_token, expiresIn: value.expires_in };
    },
    async revoke(refreshToken) {
      try { await response("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: refreshToken }).toString() }); return true; } catch { return false; }
    },
    async calendars(token) {
      const items: CalendarChoice[] = []; let next: string | undefined;
      for (let page = 0; page < 10; page++) {
        const query = new URLSearchParams({ minAccessRole: "writer", maxResults: "250", ...(next ? { pageToken: next } : {}) });
        const value = z.object({ items: z.array(choiceSchema).default([]), nextPageToken: z.string().optional() }).parse(await json(`${base}/users/me/calendarList?${query}`, { headers: headers(token) }));
        items.push(...value.items.map(choice)); next = value.nextPageToken; if (!next) return items;
      }
      throw new AccessError(503, "Há agendas demais para carregar. Revise a conta selecionada.");
    },
    async calendar(token, id) { return choice(choiceSchema.parse(await json(`${base}/users/me/calendarList/${encodeURIComponent(id)}`, { headers: headers(token) }))); },
    async events(token, id, start, end) {
      const items: GoogleEvent[] = []; let next: string | undefined;
      for (let page = 0; page < 5; page++) {
        const query = new URLSearchParams({ timeMin: start, timeMax: end, singleEvents: "true", orderBy: "startTime", showDeleted: "false", maxResults: "2500", ...(next ? { pageToken: next } : {}) });
        const value = z.object({ items: z.array(googleEventSchema).default([]), nextPageToken: z.string().optional() }).parse(await json(`${path(id)}?${query}`, { headers: headers(token) }));
        items.push(...value.items.filter((event) => event.status !== "cancelled")); next = value.nextPageToken; if (!next) return items;
      }
      throw new AccessError(503, "O período contém eventos demais. Selecione um período menor.");
    },
    async event(token, calendarId, id) { return googleEventSchema.parse(await json(path(calendarId, id), { headers: headers(token) })); },
    async insert(token, id, input) { return googleEventSchema.parse(await json(`${path(id)}?sendUpdates=none`, { method: "POST", headers: headers(token), body: JSON.stringify(input) })); },
    async update(token, calendarId, id, etag, input) { return googleEventSchema.parse(await json(`${path(calendarId, id)}?sendUpdates=none`, { method: "PATCH", headers: { ...headers(token), "If-Match": etag }, body: JSON.stringify(input) })); },
    async remove(token, calendarId, id, etag) { await response(`${path(calendarId, id)}?sendUpdates=none`, { method: "DELETE", headers: { ...headers(token), "If-Match": etag } }); },
  };
}
