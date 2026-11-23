"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { ContentDraftResponse, ContentVersion, ContentVersionsResponse } from "@dra/contracts";
import { apiRequest } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/unsaved-changes";

export function VersionsWorkspace({ admin }: { admin: boolean }) {
  const [draft, setDraft] = useState<ContentDraftResponse | null>(null);
  const [history, setHistory] = useState<ContentVersionsResponse | null>(null);
  const [detail, setDetail] = useState<ContentVersion | null>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useUnsavedChanges(Boolean(note.trim()), () => setNote(""));
  const load = useCallback(async () => {
    const [draft, history] = await Promise.all([apiRequest<ContentDraftResponse>("/content/draft"), apiRequest<ContentVersionsResponse>(`/content/versions?page=${page}`)]);
    setDraft(draft); setHistory(history);
  }, [page]);
  useEffect(() => { let alive = true; setBusy(true); setError(""); load().catch((e: Error) => { if (alive) setError(e.message); }).finally(() => { if (alive) setBusy(false); }); return () => { alive = false; }; }, [load]);
  async function activate(event: FormEvent) {
    event.preventDefault(); if (!draft) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await apiRequest<{ version: ContentVersion }>("/content/versions", { method: "POST", body: JSON.stringify({ fingerprint: draft.fingerprint, expectedActiveVersionId: draft.activeVersionId, note, confirmInternalOnly: confirmed }) });
      setNote(""); setConfirmed(false); setDetail(result.version); await load(); setNotice("Versão interna criada e ativada. Nenhum conteúdo foi enviado ao WhatsApp.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ativar."); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!detail || !history || !window.confirm(`Restaurar a versão ${detail.number} em uma nova versão interna? Seus rascunhos atuais serão preservados.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await apiRequest<{ version: ContentVersion }>(`/content/versions/${detail.id}/restore`, { method: "POST", body: JSON.stringify({ expectedActiveVersionId: history.activeVersionId, note: `Restauração da versão ${detail.number}`, confirmInternalOnly: true }) });
      setDetail(result.version); await load(); setNotice("Restauração criada como nova versão interna. Os rascunhos foram preservados.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível restaurar."); }
    finally { setBusy(false); }
  }
  async function open(id: string) {
    setBusy(true); setError("");
    try { setDetail((await apiRequest<{ version: ContentVersion }>(`/content/versions/${id}`)).version); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível abrir."); }
    finally { setBusy(false); }
  }
  const responses = draft?.snapshot.responses.filter((item) => item.isActive) ?? [];
  const knowledge = draft?.snapshot.knowledge.filter((item) => item.isActive) ?? [];
  const pendingReview = [...responses, ...knowledge].filter((item) => item.reviewStatus !== "reviewed").length;
  return <div className="versions-page">
    <div className="page-heading content-heading"><div><h1>Versões e histórico</h1></div><Link className="button-secondary" href="/simulador">Testar no simulador</Link></div>
    <div className="draft-banner"><p><strong>Ativação interna.</strong> Serve para testar versões no painel. A publicação no WhatsApp continua desabilitada.</p><button disabled className="button-secondary">Publicar no WhatsApp</button></div>
    {error && <p className="feedback feedback-error" role="alert">{error} <button className="text-action" disabled={busy} onClick={() => { setBusy(true); load().then(() => setError("")).catch((e: Error) => setError(e.message)).finally(() => setBusy(false)); }}>Atualizar prévia</button></p>}
    {notice && <p className="feedback" role="status">{notice}</p>}
    {draft && <div className="version-stats"><div className="content-card"><strong>{responses.length}</strong><span>respostas ativas</span></div><div className="content-card"><strong>{knowledge.length}</strong><span>informações ativas</span></div><div className={`content-card ${pendingReview ? "stat-warning" : ""}`}><strong>{pendingReview}</strong><span>pendentes de revisão</span></div><div className="content-card"><strong>{draft.activeVersionId ? `V${history?.items.find((item) => item.id === draft.activeVersionId)?.number ?? "—"}` : "—"}</strong><span>ativa internamente</span></div></div>}
    {busy && <p role="status" className="field-help">Carregando…</p>}
    <div className="versions-grid" aria-busy={busy}>
      <section className="content-card"><h2>Nova versão</h2>{draft && <>
        <p className="field-help">{draft.snapshot.responses.filter((item) => item.isActive).length} respostas ativas · {draft.snapshot.knowledge.filter((item) => item.isActive).length} informações ativas · Assistente {draft.snapshot.assistant ? "configurada" : "não configurada"}</p>
        <p className="field-help">A versão guarda também os itens desativados e a configuração completa. Somente itens ativos orientam o simulador.</p>
        {draft.issues.length > 0 ? <div className="feedback feedback-error"><strong>Antes de ativar:</strong><ul className="plain-list">{draft.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div> : <p className="feedback">Os conteúdos ativos estão marcados como revisados. Confira também as orientações da assistente.</p>}
        <div className="editor-actions"><Link className="text-action" href="/respostas">Revisar respostas</Link><Link className="text-action" href="/conhecimento">Revisar conhecimento</Link><Link className="text-action" href="/assistente">Revisar assistente</Link></div>
        {admin ? <form className="content-form" onSubmit={activate}><label>Descrição da versão<textarea className="field" required minLength={3} maxLength={500} rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} /></label><label className="check-label"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} required />Revisei o conteúdo e entendo que a ativação é somente interna.</label><button className="button" disabled={busy || !confirmed || draft.issues.length > 0}>Criar e ativar versão interna</button></form> : <p className="field-help mt-4">A equipe pode consultar versões e simular. Somente a administradora pode ativar ou restaurar.</p>}
      </>}</section>
      <section className="content-card"><h2>Histórico</h2>{history && <>
        {!history.items.length && <p className="field-help">Nenhuma versão criada. Os conteúdos atuais continuam como rascunhos.</p>}
        <ul className="version-list">{history.items.map((item) => <li key={item.id}><button className="model-item" disabled={busy} aria-current={detail?.id === item.id ? "true" : undefined} onClick={() => void open(item.id)}><strong>Versão {item.number} {history.activeVersionId === item.id && <span className="badge">Ativa internamente</span>}</strong><span>{item.note}</span><span className="field-help">{new Date(item.createdAt).toLocaleString("pt-BR")}{item.restoredFrom ? " · Restauração" : ""}</span></button></li>)}</ul>
        {history.total > history.pageSize && <div className="pagination"><button className="button-secondary" disabled={busy || page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page}</span><button className="button-secondary" disabled={busy || page * history.pageSize >= history.total} onClick={() => setPage(page + 1)}>Próxima</button></div>}
      </>}
      {detail && <div className="version-detail"><h3>Conteúdo da versão {detail.number}</h3><p className="field-help">{detail.note} · Registro imutável</p><details><summary>Respostas ({detail.snapshot.responses.length})</summary>{detail.snapshot.responses.map((item) => <article key={item.id}><h4>{item.title}{!item.isActive && " · Desativada"}</h4><p>{item.answer}</p><p className="field-help">{item.category} · {item.questionExamples.join(" / ")}</p>{item.variations.map((text, i) => <p key={i}>{text}</p>)}</article>)}</details><details><summary>Conhecimento ({detail.snapshot.knowledge.length})</summary>{detail.snapshot.knowledge.map((item) => <article key={item.id}><h4>{item.title}{!item.isActive && " · Desativado"}</h4><p>{item.content}</p></article>)}</details><details><summary>Assistente</summary>{detail.snapshot.assistant && Object.entries(detail.snapshot.assistant).filter(([key]) => !["id", "revision", "createdAt", "updatedAt"].includes(key)).map(([key, value]) => <p key={key}>{Array.isArray(value) ? value.join("; ") : value}</p>)}</details>
      {admin && <button className="button-secondary mt-4" disabled={busy} onClick={() => void restore()}>Restaurar em nova versão interna</button>}</div>}
      </section>
    </div>
  </div>;
}
