import { AccessError } from "../../src/modules/users/service.js";
import { CalendarAuthError, type GoogleCalendarProvider, type GoogleEvent, type GoogleEventBody } from "../../src/modules/calendar/google.js";
import { localToInstant } from "../../src/modules/calendar/time.js";

export function createCalendarFixture() {
  const records = new Map<string, GoogleEvent>();
  const fixture = { records, revoked: false, revokedResult: true, expired: false, failAfterInsert: false, exchanged: 0, inserted: 0 };
  let sequence = 1;
  const choice = { id: "clinic-fixture@example.invalid", name: "Agenda fictícia de consultas", timeZone: "America/Sao_Paulo", primary: true };
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  const find = (id: string) => { const value = records.get(id); if (!value) throw new AccessError(404, "Evento fictício não encontrado."); return value; };
  const fromBody = (id: string, body: GoogleEventBody): GoogleEvent => ({ ...body, id, etag: `"fixture-${sequence++}"`, status: "confirmed", eventType: "default" });
  const provider: GoogleCalendarProvider = {
    async exchange(code) { if (code !== "fixture-code") throw new AccessError(503, "Falha fictícia de autorização."); fixture.exchanged++; return { refreshToken: "fixture-refresh-token-only-for-tests", email: "calendar-admin@example.invalid" }; },
    async refresh() { if (fixture.expired) throw new CalendarAuthError(); return { accessToken: "fixture-access-token", expiresIn: 3600 }; },
    async revoke() { fixture.revoked = true; return fixture.revokedResult; },
    async calendars() { return [choice]; },
    async calendar(_token, id) { if (id !== choice.id) throw new AccessError(403, "Agenda fictícia sem permissão."); return choice; },
    async events(_token, _id, start, end) {
      return [...records.values()].filter((event) => {
        const a = event.start.dateTime ? new Date(event.start.dateTime) : localToInstant(`${event.start.date}T00:00`, choice.timeZone);
        const b = event.end.dateTime ? new Date(event.end.dateTime) : localToInstant(`${event.end.date}T00:00`, choice.timeZone);
        return a < new Date(end) && b > new Date(start) && event.status !== "cancelled";
      }).sort((a, b) => (a.start.dateTime ?? a.start.date!).localeCompare(b.start.dateTime ?? b.start.date!)).map(clone);
    },
    async event(_token, _calendarId, id) { return clone(find(id)); },
    async insert(_token, _id, body) { if (!body.id || records.has(body.id)) throw new AccessError(409, "Evento já existe."); const event = fromBody(body.id, body); records.set(event.id, event); fixture.inserted++; if (fixture.failAfterInsert) { fixture.failAfterInsert = false; throw new AccessError(503, "Timeout fictício após criação no provedor."); } return clone(event); },
    async update(_token, _calendarId, id, etag, body) { const original = find(id); if (original.etag !== etag) throw new AccessError(409, "Evento mudou no provedor."); const event = { ...original, ...fromBody(id, body) }; records.set(id, event); return clone(event); },
    async remove(_token, _calendarId, id, etag) { if (find(id).etag !== etag) throw new AccessError(409, "Evento mudou no provedor."); records.delete(id); },
  };
  return { ...fixture, provider, choice, controls: fixture };
}
