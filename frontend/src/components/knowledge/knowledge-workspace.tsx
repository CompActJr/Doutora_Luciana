"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { KnowledgeEntriesResponse, KnowledgeEntry, KnowledgeEntryInput, KnowledgeEntryResponse, ResponseReviewStatus } from "@dra/contracts";
import { ApiError, apiRequest } from "@/lib/api";
import { confirmDiscard, useUnsavedChanges } from "@/lib/unsaved-changes";
import { Icon } from "@/components/ui/icon";
import { ContentFilters } from "@/components/content/content-filters";

const emptyForm: KnowledgeEntryInput = { title: "", category: "Geral", content: "", reviewStatus: "draft" };
const reviewLabels: Record<ResponseReviewStatus, string> = { draft: "Rascunho", needs_review: "Em revisão", reviewed: "Revisado" };
const toForm = (entry: KnowledgeEntry): KnowledgeEntryInput => ({ title: entry.title, category: entry.category, content: entry.content, reviewStatus: entry.reviewStatus });
const message = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir a operação.";

export function KnowledgeWorkspace() {
  const [list, setList] = useState<KnowledgeEntriesResponse | null>(null);
  const [filters, setFilters] = useState({ search: "", category: "", state: "active", reviewStatus: "", page: 1 });
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [saved, setSaved] = useState<KnowledgeEntry | null>(null);
  const [form, setForm] = useState<KnowledgeEntryInput>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [panel, setPanel] = useState<"list" | "editor">("list");
  const heading = useRef<HTMLHeadingElement>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved ? toForm(saved) : emptyForm);
  useUnsavedChanges(dirty, () => setForm(saved ? toForm(saved) : emptyForm));

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setListError("");
    const timer = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams({ search: filters.search, state: filters.state, page: String(filters.page) });
        if (filters.category) query.set("category", filters.category);
        if (filters.reviewStatus) query.set("reviewStatus", filters.reviewStatus);
        const result = await apiRequest<KnowledgeEntriesResponse>(`/knowledge?${query}`, { signal: controller.signal });
        if (!controller.signal.aborted) {
          const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
          if (filters.page > lastPage) setFilters((previous) => ({ ...previous, page: lastPage }));
          else setList(result);
        }
      } catch (error) { if (!controller.signal.aborted) setListError(message(error)); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [filters, refresh]);

  function filter(key: keyof typeof filters, value: string | number) { setFilters((previous) => ({ ...previous, [key]: value, ...(key !== "page" ? { page: 1 } : {}) })); }
  function update<K extends keyof KnowledgeEntryInput>(key: K, value: KnowledgeEntryInput[K]) {
    setForm((previous) => ({ ...previous, [key]: value, ...(key !== "reviewStatus" && previous.reviewStatus === "reviewed" ? { reviewStatus: "draft" as const } : {}) })); setNotice("");
  }
  function select(entry: KnowledgeEntry) {
    setSaved(entry); setForm(toForm(entry)); setConflict(false); setPanel("editor");
    window.setTimeout(() => heading.current?.focus(), 0);
  }
  function newEntry() {
    if (!confirmDiscard(dirty)) return;
    setSaved(null); setForm(emptyForm); setError(""); setNotice(""); setConflict(false); setPanel("editor");
    window.setTimeout(() => heading.current?.focus(), 0);
  }
  async function open(id: string) {
    if (!confirmDiscard(dirty)) return;
    setBusy(true); setError(""); setNotice("");
    try { select((await apiRequest<KnowledgeEntryResponse>(`/knowledge/${id}`)).entry); }
    catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }
  function failed(error: unknown) {
    if (error instanceof ApiError && error.status === 409) {
      setConflict(true); setError("Outra pessoa alterou esta informação. Seu texto foi preservado. Copie o que deseja manter antes de reabrir a versão atual.");
    } else setError(message(error));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await apiRequest<KnowledgeEntryResponse>(saved ? `/knowledge/${saved.id}` : "/knowledge", {
        method: saved ? "PATCH" : "POST", body: JSON.stringify({ ...form, ...(saved ? { revision: saved.revision } : {}) }),
      });
      select(result.entry); setNotice("Informação salva no painel. Nenhuma alteração foi publicada no WhatsApp."); setRefresh((value) => value + 1);
    } catch (error) { failed(error); }
    finally { setBusy(false); }
  }
  async function toggle() {
    if (!saved || dirty) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await apiRequest<KnowledgeEntryResponse>(`/knowledge/${saved.id}`, { method: "PATCH", body: JSON.stringify({ revision: saved.revision, isActive: !saved.isActive }) });
      select(result.entry); setNotice(result.entry.isActive ? "Informação reativada." : "Informação desativada. O conteúdo foi preservado."); setRefresh((value) => value + 1);
    } catch (error) { failed(error); }
    finally { setBusy(false); }
  }

  return <div className="knowledge-page" data-panel={panel}>
    <div className="page-heading content-heading"><div><h1>Base de conhecimento</h1></div><button className="button create-content" onClick={newEntry} disabled={busy} aria-label="Nova informação"><Icon name="plus" className="size-4" /><span>Nova informação</span></button></div>
    <div className="draft-banner"><Icon name="lock" className="size-4 shrink-0" /><p>Salvar ou marcar como revisado não publica conteúdo para o bot. Não inclua dados pessoais de pacientes.</p></div>
    <div className="mobile-editor-heading"><button className="icon-button" aria-label="Voltar às informações" onClick={() => setPanel("list")}><Icon name="back" className="size-5" /></button><strong>{form.title || "Nova informação"}</strong></div>
    {error && <div className="feedback feedback-error" role="alert"><p>{error}</p>{conflict && saved && <button className="button-secondary mt-3" disabled={busy} onClick={() => void open(saved.id)}>Reabrir versão atual</button>}</div>}
    {notice && <p className="feedback" role="status">{notice}</p>}
    <div className="knowledge-workspace" aria-busy={busy}>
      <section className={`response-list workspace-panel ${panel === "list" ? "mobile-visible" : ""}`} aria-labelledby="knowledge-list-title">
        <div className="section-heading"><h2 id="knowledge-list-title">Informações cadastradas</h2><span className="badge">{loading ? "…" : listError ? "—" : list?.total ?? 0}</span></div>
        <ContentFilters search={filters.search} label="Buscar informações" value={filters} onSearch={(value) => filter("search", value)} onQuickFilter={(value) => setFilters((previous) => ({ ...previous, ...value, page: 1 }))}>
          <label><span className="sr-only">Filtrar categoria</span><select aria-label="Filtrar categoria" className="field" value={filters.category} onChange={(event) => filter("category", event.target.value)}><option value="">Todas as categorias</option>{list?.categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2"><label><span className="sr-only">Filtrar atividade</span><select aria-label="Filtrar atividade" className="field" value={filters.state} onChange={(event) => filter("state", event.target.value)}><option value="active">Ativas</option><option value="inactive">Desativadas</option><option value="all">Todas</option></select></label><label><span className="sr-only">Filtrar revisão</span><select aria-label="Filtrar revisão" className="field" value={filters.reviewStatus} onChange={(event) => filter("reviewStatus", event.target.value)}><option value="">Toda revisão</option>{Object.entries(reviewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        </ContentFilters>
        <div className="model-list" aria-busy={loading}>{loading ? <p className="list-placeholder" role="status">Carregando informações…</p> : listError ? <div className="list-placeholder" role="alert"><p>{listError}</p><button className="button-secondary mt-3" onClick={() => setRefresh((value) => value + 1)}>Tentar novamente</button></div> : !list?.items.length ? <div className="empty-list"><Icon name="knowledge" className="size-9" /><h3>Nenhuma informação cadastrada</h3><p>Nenhuma informação encontrada. Cadastre um conteúdo ou ajuste os filtros.</p><button className="text-action" disabled={busy} onClick={newEntry}>Cadastrar informação</button></div> : <ul>{list.items.map((entry) => <li key={entry.id}><button className="model-item" disabled={busy} aria-current={saved?.id === entry.id ? "true" : undefined} onClick={() => void open(entry.id)}><span className="model-category">{entry.category}</span><strong>{entry.title}</strong><span className="model-meta"><span className={`review-dot ${entry.reviewStatus}`} />{reviewLabels[entry.reviewStatus]}{!entry.isActive && " · Desativada"}</span></button></li>)}</ul>}</div>
        {list && list.total > list.pageSize && <div className="pagination"><button className="button-secondary" disabled={loading || filters.page <= 1} onClick={() => filter("page", filters.page - 1)}>Anterior</button><span>{filters.page} / {Math.ceil(list.total / list.pageSize)}</span><button className="button-secondary" disabled={loading || filters.page * list.pageSize >= list.total} onClick={() => filter("page", filters.page + 1)}>Próxima</button></div>}
      </section>
      <section className={`response-editor workspace-panel ${panel === "editor" ? "mobile-visible" : ""}`} aria-labelledby="knowledge-editor-title">
        <div className="editor-heading"><h2 ref={heading} tabIndex={-1} id="knowledge-editor-title">{saved ? saved.title : "Nova informação"}</h2><label><span className="sr-only">Estado de revisão</span><select aria-label="Estado de revisão" className="review-select" disabled={busy} value={form.reviewStatus} onChange={(event) => update("reviewStatus", event.target.value as ResponseReviewStatus)}>{Object.entries(reviewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        <form onSubmit={save}><fieldset className="editor-fields" disabled={busy}>
          <div className="editor-basics"><label>Título da informação<input className="field" required minLength={3} maxLength={120} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Ex.: Orientações para o primeiro atendimento" /></label><label>Categoria<input className="field" required maxLength={80} value={form.category} list="knowledge-categories" onChange={(event) => update("category", event.target.value)} /><datalist id="knowledge-categories">{list?.categories.map((category) => <option key={category} value={category} />)}</datalist></label></div>
          <label><span id="knowledge-content-label">Conteúdo</span><textarea className="field" rows={14} required maxLength={12000} value={form.content} onChange={(event) => update("content", event.target.value)} aria-labelledby="knowledge-content-label" aria-describedby="knowledge-content-help" placeholder="Registre apenas informações confirmadas pela clínica…" /><span className="field-help field-counter" id="knowledge-content-help"><span>Não inclua dados pessoais de pacientes. Informações clínicas precisam de revisão da doutora.</span><span>{form.content.length}/12000</span></span></label>
          {saved && !saved.isActive && <p className="field-help">Esta informação está desativada e continua preservada no painel.</p>}
          {saved && <details className="editor-options"><summary>Mais ações</summary><button type="button" className="text-action" disabled={busy || dirty || conflict} onClick={() => void toggle()}>{saved.isActive ? "Desativar" : "Reativar"}</button></details>}
          <p className="field-help">As informações ficam no painel. A consulta pelo bot depende das próximas etapas.</p>
        </fieldset><div className="editor-actions editor-save-bar"><span className={`save-state ${dirty ? "unsaved" : ""}`}>{dirty ? "Alterações não salvas" : saved ? "Salvo no painel" : "Novo rascunho"}</span><button className="button" disabled={busy || conflict || Boolean(saved && !dirty)}>{busy ? "Aguarde…" : "Salvar rascunho"}</button></div></form>
      </section>
    </div>
  </div>;
}
