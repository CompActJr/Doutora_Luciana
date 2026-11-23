import { ApiError } from "./api";
export async function calendarRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/v1/calendar${path}`, { ...options, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json", ...options.headers } }); }
  catch { throw new Error("Não foi possível conectar ao servidor. Sua edição foi preservada."); }
  if (!response.ok) {
    // A API da agenda expõe somente mensagens próprias; erros brutos do Google não são repassados.
    const body = await response.json().catch(() => null) as { message?: unknown } | null;
    throw new ApiError(response.status, typeof body?.message === "string" && body.message.length <= 500 ? body.message : "Não foi possível concluir. Atualize a agenda antes de tentar novamente.");
  }
  return response.json() as Promise<T>;
}
export function localDateTime(value: string | Date, timeZone: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const p = Object.fromEntries(new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function addDays(value: string, days: number) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
export function periodFor(anchor: string, view: "day" | "week" | "month") {
  if (view === "day") return { from: anchor, to: addDays(anchor, 1) };
  if (view === "week") { const weekday = new Date(`${anchor}T12:00:00Z`).getUTCDay(); const from = addDays(anchor, -((weekday + 6) % 7)); return { from, to: addDays(from, 7) }; }
  const from = `${anchor.slice(0, 7)}-01`, next = new Date(`${from}T12:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
  return { from, to: next.toISOString().slice(0, 10) };
}
