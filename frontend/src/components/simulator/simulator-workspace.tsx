"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { AiStatusResponse, ContentVersionsResponse, Simulation, SimulationResponse, SimulationsResponse } from "@dra/contracts";
import { apiRequest, ApiError } from "@/lib/api";
import { confirmDiscard, useUnsavedChanges } from "@/lib/unsaved-changes";
import { Icon } from "@/components/ui/icon";

export function SimulatorWorkspace() {
  const [status, setStatus] = useState<AiStatusResponse | null>(null);
  const [versions, setVersions] = useState<ContentVersionsResponse | null>(null);
  const [list, setList] = useState<Simulation[]>([]);
  const [conversation, setConversation] = useState<Simulation | null>(null);
  const [mode, setMode] = useState<"demo" | "openai">("demo");
  const [version, setVersion] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const pending = useRef<{ text: string; id: string } | null>(null);
  const messageField = useRef<HTMLTextAreaElement>(null);
  useUnsavedChanges(Boolean(text.trim()) || busy && Boolean(conversation), () => setText(""));
  const load = useCallback(async () => {
    const [status, versions, simulations] = await Promise.all([apiRequest<AiStatusResponse>("/ai/status"), apiRequest<ContentVersionsResponse>("/content/versions"), apiRequest<SimulationsResponse>("/simulations")]);
    setStatus(status); setVersions(versions); setList(simulations.items);
  }, []);
  useEffect(() => { load().catch((e: Error) => setError(e.message)).finally(() => setBusy(false)); }, [load]);
  async function create() {
    if (!confirmDiscard(Boolean(text.trim()))) return;
    setBusy(true); setError("");
    try { const result = await apiRequest<SimulationResponse>("/simulations", { method: "POST", body: JSON.stringify({ mode, versionId: version || null }) }); setConversation(result.simulation); setShowControls(false); setText(""); setConflict(false); pending.current = null; await load(); messageField.current?.focus(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar a conversa."); }
    finally { setBusy(false); }
  }
  async function open(id: string) {
    if (!confirmDiscard(Boolean(text.trim()))) return;
    setBusy(true); setError("");
    try { setConversation((await apiRequest<SimulationResponse>(`/simulations/${id}`)).simulation); setShowControls(false); setText(""); setConflict(false); pending.current = null; }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível abrir."); }
    finally { setBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (!conversation || !text.trim()) return;
    setBusy(true); setError("");
    if (!pending.current || pending.current.text !== text) pending.current = { text, id: crypto.randomUUID() };
    try {
      const result = await apiRequest<SimulationResponse>(`/simulations/${conversation.id}/messages`, { method: "POST", body: JSON.stringify({ content: text, revision: conversation.revision, requestId: pending.current.id }) });
      setConversation(result.simulation); setText(""); pending.current = null; await load();
    } catch (e) { if (e instanceof ApiError && e.status === 409) setConflict(true); setError(e instanceof Error ? e.message : "Não foi possível responder."); }
    finally { setBusy(false); window.setTimeout(() => messageField.current?.focus(), 0); }
  }
  async function remove(id: string) {
    if (!confirmDiscard(Boolean(text.trim())) || !window.confirm("Excluir esta conversa de teste?")) return;
    setBusy(true); setError("");
    try { await apiRequest(`/simulations/${id}`, { method: "DELETE", body: "{}" }); if (conversation?.id === id) { setConversation(null); setShowControls(true); setText(""); } await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível excluir."); }
    finally { setBusy(false); }
  }
  async function moreVersions() {
    if (!versions) return;
    setBusy(true); setError("");
    try { const next = await apiRequest<ContentVersionsResponse>(`/content/versions?page=${versions.page + 1}`); setVersions({ ...next, items: [...versions.items, ...next.items] }); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar versões."); }
    finally { setBusy(false); }
  }
  return <div className="simulator-page" data-controls={showControls}>
    <div className="page-heading"><div><h1>Simulador</h1></div><button className="button-secondary simulator-menu-toggle" onClick={() => setShowControls((value) => !value)} aria-expanded={showControls} aria-controls="simulator-controls">Conversas</button></div>
    <div className="draft-banner"><p><strong>Somente testes.</strong> Não há envio ao WhatsApp, acesso à agenda ou ações sobre pacientes. Use dados fictícios. O conteúdo fica fixo ao criar cada conversa.</p></div>
    {error && <div className="feedback feedback-error" role="alert"><p>{error}</p><button className="text-action" disabled={busy} onClick={() => { setBusy(true); load().then(() => setError("")).catch((e: Error) => setError(e.message)).finally(() => setBusy(false)); }}>Atualizar dados</button>{conflict && conversation && <button className="button-secondary" disabled={busy} onClick={() => void open(conversation.id)}>Reabrir conversa atual</button>}</div>}
    <div className="simulator-grid" aria-busy={busy}>
      <aside className="content-card simulator-controls" id="simulator-controls"><h2>Nova conversa</h2><div className="content-form"><label>Conteúdo para testar<select className="field" value={version} onChange={(e) => setVersion(e.target.value)} disabled={busy}><option value="">Rascunhos atuais (inclui conteúdo em revisão)</option>{versions?.items.map((item) => <option value={item.id} key={item.id}>Versão {item.number}{versions.activeVersionId === item.id ? " · Ativa internamente" : ""}</option>)}</select></label>{versions && versions.items.length < versions.total && <button className="text-action" disabled={busy} onClick={() => void moreVersions()}>Carregar versões anteriores</button>}
      <label>Tipo de simulação<select className="field" value={mode} onChange={(e) => setMode(e.target.value as "demo" | "openai")} disabled={busy}><option value="demo">Demonstrativa · sem IA</option><option value="openai" disabled={!status?.available}>IA real · OpenAI{!status?.available ? " (não configurada)" : ""}</option></select></label><p className="field-help">{mode === "demo" ? "A demonstração busca um texto cadastrado. Não interpreta a conversa como uma IA." : "Envia regras, conteúdos relevantes e as últimas mensagens à OpenAI. Consome a API configurada pela clínica."}</p><button className="button" disabled={busy || !status} onClick={() => void create()}>Iniciar conversa</button></div>
      <h2 className="mt-7">Seus testes</h2><p className="field-help">Somente você vê estas conversas. Até 50 testes; exclua os que não precisar.</p><ul className="simulation-list">{list.map((item) => <li key={item.id}><button className="model-item" disabled={busy} aria-current={conversation?.id === item.id ? "true" : undefined} onClick={() => void open(item.id)}><strong>{item.messages.find((message) => message.role === "user")?.content.slice(0, 60) || "Conversa sem mensagens"}</strong><span className="field-help">{item.mode === "demo" ? "Demonstrativa" : "IA real"} · {item.versionId ? "Versão salva" : "Cópia dos rascunhos"} · {new Date(item.createdAt).toLocaleDateString("pt-BR")}</span></button><button className="text-action" disabled={busy} onClick={() => void remove(item.id)}>Excluir teste</button></li>)}</ul>{!list.length && <p className="field-help">Nenhuma conversa de teste.</p>}
      <Link className="text-action mt-4" href="/configuracoes/integracoes">Ver conexão da IA</Link></aside>
      <section className="content-card simulator-chat"><div className="simulator-chat-heading"><span className="chat-brand"><img src="/images/logos/dra_luciana_logo_icon_cl.png" alt="" width="22" height="26" /></span><h2>Conversa de teste</h2>{conversation && <span className={`badge ${conversation.mode === "demo" ? "" : "badge-warning"}`}>{conversation.mode === "demo" ? "Demonstrativa · sem IA" : "IA real · OpenAI"}</span>}</div>{conversation ? <>
        <p className="simulation-context">{conversation.versionId ? "Versão salva" : "Cópia dos rascunhos ao iniciar"} · Teste, nada é enviado ao WhatsApp</p>
        <div className="simulation-messages" role="log" aria-label="Mensagens da simulação" aria-live="polite">{conversation.messages.length ? conversation.messages.map((message, i) => <div key={i} className={`message ${message.role === "user" ? "message-question" : "message-answer"}`}><strong>{message.role === "user" ? "Você" : conversation.mode === "demo" ? "Demonstração" : "Assistente · IA"}</strong><p>{message.content}</p>{Boolean(message.sources?.length) && <details><summary>Conteúdos fornecidos como contexto</summary><ul className="plain-list">{message.sources?.map((source) => <li key={source.id}>{source.kind === "response" ? "Resposta" : "Conhecimento"}: {source.title}</li>)}</ul></details>}</div>) : <p className="field-help">Escreva uma pergunta fictícia para começar.</p>}</div>
        <form className="content-form simulation-composer" onSubmit={send}><label><span className="sr-only">Mensagem de teste</span><textarea ref={messageField} className="field" required maxLength={2000} rows={2} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} placeholder="Escreva como se fosse um paciente" /></label><button className="button" aria-label={busy ? "Processando…" : "Testar resposta"} disabled={busy || conflict || !text.trim() || conversation.messages.length >= 40}><Icon name="arrow" className="size-5" /></button><p className="field-help">{conversation.messages.length / 2}/20 perguntas · {text.length}/2000 caracteres · {busy ? "Processando…" : "Somente teste"}</p></form>
      </> : <p className="field-help">Escolha o conteúdo e inicie uma conversa. Primeiro salve a configuração da assistente, se ainda não estiver cadastrada.</p>}</section>
    </div>
  </div>;
}
