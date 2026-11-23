"use client";
import { useCallback, useEffect, useId, useState } from "react";
import type { CalendarChoice, CalendarStatus } from "@dra/contracts";
import { calendarRequest } from "@/lib/calendar";
import { Icon } from "@/components/ui/icon";

export function useCalendarStatus() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => { const value = await calendarRequest<CalendarStatus>("/status"); setStatus(value); setError(""); return value; }, []);
  useEffect(() => { reload().catch((error: Error) => setError(error.message)); }, [reload]);
  return { status, error, reload };
}
export function CalendarConnectionPanel({ status, reload, disabled = false }: { status: CalendarStatus | null; reload: () => Promise<unknown>; disabled?: boolean }) {
  const selectId = useId();
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<CalendarChoice[] | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inactive = busy || disabled;
  async function connect() {
    setBusy(true); setError("");
    try { const { authorizationUrl } = await calendarRequest<{ authorizationUrl: string }>("/connect", { method: "POST", body: "{}" }); window.location.assign(authorizationUrl); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível iniciar a conexão."); setBusy(false); }
  }
  async function loadChoices() {
    setBusy(true); setError("");
    try { const { items } = await calendarRequest<{ items: CalendarChoice[] }>("/calendars"); setChoices(items); setSelected(status?.calendar?.id ?? ""); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível consultar agendas."); await reload().catch(() => {}); }
    finally { setBusy(false); }
  }
  async function choose() {
    if (!status || !selected) return;
    setBusy(true); setError(""); setNotice("");
    try { await calendarRequest("/selection", { method: "PUT", body: JSON.stringify({ calendarId: selected, connectionRevision: status.revision, connectionGeneration: status.generation }) }); setChoices(null); await reload(); setNotice("Agenda selecionada. As consultas são lidas diretamente do Google."); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível selecionar."); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    if (!status || !window.confirm("Desconectar o Google Agenda deste painel? Os compromissos existentes no Google serão preservados.")) return;
    setBusy(true); setError(""); setNotice("");
    try { const result = await calendarRequest<{ revoked: boolean }>("/disconnect", { method: "POST", body: JSON.stringify({ connectionRevision: status.revision, connectionGeneration: status.generation }) }); setChoices(null); await reload(); setNotice(result.revoked ? "Conta desconectada. Os compromissos foram preservados no Google." : "Conta removida do painel. A revogação no Google não foi confirmada; confira as permissões da conta Google."); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível desconectar."); }
    finally { setBusy(false); }
  }
  return <section className="content-card calendar-connection" aria-busy={busy}><div className="integration-heading"><Icon name="calendar" /><div><h2>Google Agenda</h2><span className="field-help">Consultas da clínica</span></div></div><span className={`badge ${status?.connected && !status.needsReconnect ? "badge-success" : ""}`}>{status?.connected ? status.needsReconnect ? "Reconectar" : "Conta conectada" : "Sem conexão"}</span>
    {!status ? <p role="status">Consultando conexão…</p> : <>
    {!status.configured && <p>A conexão com o Google Agenda ainda não está disponível.</p>}
    {status.connected && <><p>Conta: <strong>{status.email}</strong></p><p className="field-help">{status.calendar ? `${status.calendar.name} · ${status.calendar.timeZone}` : "Escolha a agenda de consultas para começar."}</p>{status.needsReconnect && <p className="feedback feedback-error">O Google solicitou uma nova autorização. Reconecte a conta para consultar e gerenciar as consultas.</p>}</>}
    <div className="editor-actions mt-4"><button className="button" type="button" disabled={inactive || !status.configured} onClick={() => void connect()}>{busy ? "Aguarde…" : status.connected ? "Reconectar conta Google" : "Conectar Google Agenda"}</button>{status.connected && <><button className="button-secondary" type="button" disabled={inactive || status.needsReconnect || !status.configured} onClick={() => void loadChoices()}>{status.calendar ? "Alterar agenda" : "Escolher agenda"}</button><button className="text-action" type="button" disabled={inactive} onClick={() => void disconnect()}>Desconectar</button></>}</div>
    {choices && <div className="content-form"><label htmlFor={selectId}>Agenda de consultas</label><select id={selectId} className="field" value={selected} disabled={inactive} onChange={(e) => setSelected(e.target.value)}><option value="">Selecione uma agenda</option>{choices.map((item) => <option key={item.id} value={item.id}>{item.name}{item.primary ? " · Principal" : ""} · {item.timeZone}</option>)}</select>{!choices.length && <p className="field-help">Nenhuma agenda com permissão de edição. Confira o compartilhamento no Google.</p>}<button className="button-secondary" disabled={inactive || !selected} onClick={() => void choose()}>Usar esta agenda</button></div>}
    </>}{error && <p role="alert" className="feedback feedback-error mt-4">{error}</p>}{notice && <p role="status" className="feedback mt-4">{notice}</p>}<p className="field-help mt-4">Acesso exclusivo da administradora. A agenda é independente do WhatsApp e da IA.</p>
  </section>;
}
export function CalendarIntegrationCard() {
  const { status, error, reload } = useCalendarStatus();
  return <>{error && <p role="alert" className="feedback feedback-error">{error}</p>}<CalendarConnectionPanel status={status} reload={reload} /></>;
}
