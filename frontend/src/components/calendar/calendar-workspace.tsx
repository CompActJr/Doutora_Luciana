"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { Appointment, AppointmentInput, CalendarEventsResponse } from "@dra/contracts";
import { ApiError } from "@/lib/api";
import { calendarRequest, localDateTime, addDays, periodFor } from "@/lib/calendar";
import { confirmDiscard, useUnsavedChanges } from "@/lib/unsaved-changes";
import { CalendarConnectionPanel, useCalendarStatus } from "./connection-panel";
import { CalendarTimeline } from "./calendar-timeline";

const blank: AppointmentInput = { title: "", notes: "", startLocal: "", endLocal: "" };
const labelDate = (day: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
export function CalendarWorkspace() {
  const { status, error: statusError, reload } = useCalendarStatus();
  const zone = status?.calendar?.timeZone ?? "America/Sao_Paulo";
  const [anchor, setAnchor] = useState(() => localDateTime(new Date(), "America/Sao_Paulo").slice(0, 10));
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [data, setData] = useState<CalendarEventsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [saved, setSaved] = useState<Appointment | null>(null);
  const [form, setForm] = useState<AppointmentInput>(blank);
  const [editing, setEditing] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [editorConnection, setEditorConnection] = useState<{ connectionRevision: number; connectionGeneration: string | null } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [callback, setCallback] = useState<string | null>(null);
  useEffect(() => { const url = new URL(window.location.href); setCallback(url.searchParams.get("connection")); if (url.searchParams.has("connection")) { url.searchParams.delete("connection"); window.history.replaceState(null, "", url); } }, []);
  const titleField = useRef<HTMLInputElement>(null);
  const pending = useRef<{ payload: string; requestId: string } | null>(null);
  const initial = useMemo(() => saved ? { title: saved.title, notes: saved.notes, startLocal: saved.allDay ? "" : localDateTime(saved.start, zone), endLocal: saved.allDay ? "" : localDateTime(saved.end, zone) } : blank, [saved, zone]);
  const dirty = editing && JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedChanges(dirty || busy, () => { setForm(initial); });
  const period = periodFor(anchor, view);
  const connected = Boolean(status?.configured && status.connected && status.calendar && !status.needsReconnect);
  const generation = status?.generation, revision = status?.revision;
  useEffect(() => {
    if (!connected || !generation || !revision) { setData(null); setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setError(""); setData(null);
    const query = new URLSearchParams({ from: period.from, to: period.to, connectionRevision: String(revision), connectionGeneration: generation });
    calendarRequest<CalendarEventsResponse>(`/events?${query}`, { signal: controller.signal }).then((value) => { if (!controller.signal.aborted) setData(value); })
      .catch((e: Error) => { if (!controller.signal.aborted) { setError(e.message); void reload().catch(() => {}); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [connected, generation, revision, period.from, period.to, refresh, reload]);
  const days: string[] = [];
  for (let day = period.from; day < period.to; day = addDays(day, 1)) days.push(day);
  const eventsOn = (day: string) => (data?.items ?? []).filter((item) => item.allDay ? item.start <= day && item.end > day : localDateTime(item.start, zone).slice(0, 10) <= day && localDateTime(new Date(new Date(item.end).getTime() - 1), zone).slice(0, 10) >= day);
  const time = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  function open(item: Appointment) {
    if (!confirmDiscard(dirty)) return;
    setEditorConnection(status ? { connectionRevision: status.revision, connectionGeneration: status.generation } : null);
    setSaved(item); setForm({ title: item.title, notes: item.notes, startLocal: item.allDay ? "" : localDateTime(item.start, zone), endLocal: item.allDay ? "" : localDateTime(item.end, zone) }); setEditing(true); setConflict(false); setError(""); setNotice(""); pending.current = null;
    window.setTimeout(() => titleField.current?.focus(), 0);
  }
  function create(day = anchor) {
    if (!confirmDiscard(dirty)) return;
    setEditorConnection(status ? { connectionRevision: status.revision, connectionGeneration: status.generation } : null);
    setNewDate(day);
    setSaved(null); setForm(blank); setEditing(true); setConflict(false); setError(""); setNotice(""); pending.current = null;
    window.setTimeout(() => titleField.current?.focus(), 0);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!status) return;
    setBusy(true); setError(""); setNotice("");
    const payload = JSON.stringify({ ...form, ...editorConnection });
    if (!pending.current || pending.current.payload !== payload) pending.current = { payload, requestId: crypto.randomUUID() };
    try {
      await calendarRequest<{ event: Appointment }>(saved ? `/events/${saved.id}` : "/events", { method: saved ? "PATCH" : "POST", body: JSON.stringify({ ...JSON.parse(payload), ...(saved ? { etag: saved.etag } : { requestId: pending.current.requestId }) }) });
      setEditing(false); setSaved(null); setForm(blank); setConflict(false); pending.current = null; setRefresh((v) => v + 1); setNotice(saved ? "Consulta atualizada no Google Agenda." : "Consulta criada no Google Agenda.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); if (e instanceof ApiError && e.status === 409) setConflict(true); }
    finally { setBusy(false); }
  }
  async function cancelAppointment() {
    if (!saved || !status || !window.confirm(`Cancelar “${saved.title}” no Google Agenda?${saved.recurring ? " Somente esta ocorrência será cancelada." : ""}`)) return;
    setBusy(true); setError(""); setNotice("");
    try { await calendarRequest(`/events/${saved.id}`, { method: "DELETE", body: JSON.stringify({ etag: saved.etag, ...editorConnection, confirmCancellation: true }) }); setEditing(false); setSaved(null); setForm(blank); setRefresh((v) => v + 1); setNotice("Consulta cancelada no Google Agenda."); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível cancelar."); if (e instanceof ApiError && e.status === 409) setConflict(true); }
    finally { setBusy(false); }
  }
  function close() { if (confirmDiscard(dirty)) { setEditing(false); setSaved(null); setForm(blank); setConflict(false); } }
  function move(direction: number) {
    if (view === "month") { const date = new Date(`${anchor.slice(0, 7)}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + direction); setAnchor(date.toISOString().slice(0, 10)); }
    else setAnchor(addDays(anchor, direction * (view === "week" ? 7 : 1)));
  }
  return <div className="calendar-page"><div className="page-heading content-heading"><div><h1>Agenda</h1></div><div className="editor-actions"><button className="button-secondary" disabled={busy || dirty} onClick={() => setConnectionOpen((v) => !v)}>Conexão Google</button><button className="button" disabled={!connected || loading || busy} onClick={() => create()}>Nova consulta</button></div></div>
    {callback && (callback !== "connected" || status?.connected && !status.calendar) && <p className={`feedback ${callback === "connected" ? "" : "feedback-error"}`} role="status">{callback === "connected" ? "Conta Google autorizada. Escolha a agenda da clínica para continuar." : callback === "denied" ? "A autorização foi cancelada. Você pode tentar conectar novamente." : "Não foi possível concluir a autorização. Confira a configuração e inicie a conexão novamente."}</p>}
    {(error || statusError) && <div role="alert" className="feedback feedback-error"><p>{error || statusError}</p><button className="text-action" disabled={busy || loading} onClick={() => { setConflict(false); setRefresh((v) => v + 1); void reload().catch(() => {}); }}>Atualizar agenda</button>{editing && <p className="field-help">Sua edição foi preservada. Após atualizar, reabra o evento para obter sua versão atual, ou revise o horário antes de tentar novamente.</p>}</div>}
    {notice && <p className="feedback" role="status">{notice}</p>}
    {(!connected || connectionOpen) && <CalendarConnectionPanel status={status} reload={reload} disabled={busy || editing} />}
    {connected && <><div className="calendar-toolbar"><div><h2>{status?.calendar?.name}</h2><p className="field-help">Fuso: {zone}{data ? ` · Atualizado às ${time(data.fetchedAt)}` : ""}</p></div><div className="editor-actions"><button className="button-secondary" disabled={busy} onClick={() => move(-1)} aria-label="Período anterior">‹</button><button className="button-secondary" disabled={busy} onClick={() => setAnchor(localDateTime(new Date(), zone).slice(0, 10))}>Hoje</button><button className="button-secondary" disabled={busy} onClick={() => move(1)} aria-label="Próximo período">›</button><label><span className="sr-only">Data da agenda</span><input type="date" className="field" value={anchor} onChange={(e) => { if (e.target.value) setAnchor(e.target.value); }} disabled={busy} /></label><label><span className="sr-only">Visualização da agenda</span><select className="field" value={view} onChange={(e) => setView(e.target.value as typeof view)} disabled={busy}><option value="day">Dia</option><option value="week">Semana</option><option value="month">Mês</option></select></label><button className="button-secondary" disabled={busy || loading} onClick={() => setRefresh((v) => v + 1)}>Atualizar</button></div></div>
    <p className="field-help calendar-range">{labelDate(period.from)}{view !== "day" && ` até ${labelDate(addDays(period.to, -1))}`}</p>
    {editing && !saved && newDate && <p className="field-help mb-4">Dia escolhido ao abrir: {labelDate(newDate)}. Informe o início e o término; a duração da consulta não é definida automaticamente.</p>}
    <div className={`calendar-layout ${editing ? "with-editor" : ""}`} aria-busy={loading || busy}>
      <section className="content-card calendar-board" aria-label="Consultas no período">{loading ? <p role="status">Consultando horários no Google…</p> : data ? <>
      {!data.items.length && <p className="feedback" role="status">Nenhum compromisso encontrado neste período.</p>}
      {view !== "month" ? <CalendarTimeline key={`${view}:${anchor}`} days={days} anchor={anchor} items={data.items} zone={zone} selectedId={saved?.id} busy={busy} onOpen={open} onCreate={create} /> : <div className="calendar-days calendar-month" style={{ "--calendar-start": String((new Date(`${period.from}T12:00:00Z`).getUTCDay() + 6) % 7 + 1) } as CSSProperties}>
        {days.map((day) => <section key={day} className="calendar-day"><div className="calendar-day-heading"><h3>{new Intl.DateTimeFormat("pt-BR", { day: "numeric", weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`))}</h3><button className="text-action" disabled={busy} aria-label={`Nova consulta em ${day}`} onClick={() => create(day)}>+</button></div>{eventsOn(day).map((event) => <button key={event.id} className={`calendar-event ${!event.editable ? "is-readonly" : ""}`} disabled={busy} aria-current={saved?.id === event.id ? "true" : undefined} onClick={() => open(event)}><span>{event.allDay ? "Dia inteiro" : `${time(event.start)} – ${time(event.end)}`}</span><strong>{event.title}</strong>{event.recurring && <small>Recorrente</small>}{!event.editable && <small>Somente visualização</small>}</button>)}{!eventsOn(day).length && <span className="calendar-empty">Sem compromissos</span>}</section>)}
      </div>}</> : <p className="field-help">Não foi possível carregar os horários. Use Atualizar agenda.</p>}</section>
      {editing && <section className="content-card calendar-editor"><div className="section-heading"><h2>{saved ? saved.editable ? "Editar consulta" : "Detalhes do evento" : "Nova consulta"}</h2><button className="text-action" disabled={busy} onClick={close}>Fechar</button></div>{saved?.recurring && <p className="feedback">As alterações afetam somente esta ocorrência.</p>}{saved && !saved.editable ? <><p>{saved.title}</p><p>{saved.allDay ? `${saved.start} · Dia inteiro` : `${localDateTime(saved.start, zone).replace("T", " ")} – ${time(saved.end)}`}</p><p className="calendar-notes">{saved.notes}</p><p className="field-help">Eventos de dia inteiro, especiais, bloqueados ou com convidados são exibidos aqui e devem ser gerenciados no Google Agenda.</p></> : <form className="content-form" onSubmit={save}><fieldset disabled={busy} className="calendar-fields"><label htmlFor="appointment-title">Título da consulta</label><input ref={titleField} id="appointment-title" className="field" required minLength={3} maxLength={120} value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setConflict(false); }} /><label htmlFor="appointment-start">Início</label><input id="appointment-start" className="field" type="datetime-local" required value={form.startLocal} onChange={(e) => { setForm({ ...form, startLocal: e.target.value }); setConflict(false); }} /><label htmlFor="appointment-end">Término</label><input id="appointment-end" className="field" type="datetime-local" required value={form.endLocal} onChange={(e) => { setForm({ ...form, endLocal: e.target.value }); setConflict(false); }} /><label htmlFor="appointment-notes">Observações administrativas</label><textarea id="appointment-notes" rows={3} className="field" maxLength={2000} value={form.notes} onChange={(e) => { setForm({ ...form, notes: e.target.value }); setConflict(false); }} /><p className="field-help">Horários em {zone}. Evite dados clínicos sensíveis. Salvar altera diretamente o Google Agenda; não envia WhatsApp nem cria lembretes pelo painel.</p><div className="editor-actions"><button className="button" disabled={busy || conflict || saved !== null && !dirty}>{busy ? "Salvando…" : "Salvar no Google Agenda"}</button>{saved && <button className="button-secondary" type="button" disabled={busy || dirty || conflict} onClick={() => void cancelAppointment()}>Cancelar consulta</button>}</div>{dirty && <p role="status" className="field-help">Alterações ainda não salvas no Google.</p>}</fieldset></form>}</section>}
    </div><p className="field-help mt-4">Os horários são consultados diretamente no Google. Antes de salvar, o painel verifica sobreposição; mudanças feitas simultaneamente por outros aplicativos podem ocorrer. Não há agendamento automático por IA.</p></>}
  </div>;
}
