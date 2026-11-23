import { AccessError } from "../users/service.js";
export function validTimeZone(zone: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(); return true; } catch { return false; }
}
function localParts(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const p = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
// Reconhece horários inexistentes/ambíguos em transições de fuso, sem supor UTC-3.
export function localToInstant(local: string, zone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || !validTimeZone(zone)) throw new AccessError(400, "Data ou fuso inválido.");
  const nominal = new Date(`${local}:00Z`);
  if (!Number.isFinite(nominal.getTime()) || nominal.toISOString().slice(0, 16) !== local) throw new AccessError(400, "Data inválida.");
  const offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const candidate = new Date(nominal.getTime() + hours * 3600000);
    const wall = new Date(`${localParts(candidate, zone)}:00Z`).getTime();
    offsets.add(wall - candidate.getTime());
  }
  const candidates = [...offsets].map((offset) => new Date(nominal.getTime() - offset)).filter((date) => localParts(date, zone) === local);
  if (candidates.length !== 1) throw new AccessError(400, "Este horário é inexistente ou ambíguo no fuso da agenda. Escolha outro horário.");
  return candidates[0];
}
