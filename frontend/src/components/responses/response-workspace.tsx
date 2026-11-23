"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ResponseReviewStatus, ResponseTemplate, ResponseTemplateInput, ResponseTemplateResponse, ResponseTemplatesResponse } from "@dra/contracts";
import { ApiError, apiRequest } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { VariationSuggestions } from "./variation-suggestions";
import { ContentFilters } from "@/components/content/content-filters";

type Form = Omit<ResponseTemplateInput, "questionExamples" | "variations"> & { questions: string; variationsText: string };
type Panel = "list" | "editor" | "preview";
const emptyForm: Form = { title: "", category: "Geral", questions: "", answer: "", variationsText: "", reviewStatus: "draft" };
const reviewLabels: Record<ResponseReviewStatus, string> = { draft: "Rascunho", needs_review: "Em revisão", reviewed: "Revisado" };
const toForm = (item: ResponseTemplate): Form => ({ title: item.title, category: item.category,
  questions: item.questionExamples.join("\n"), answer: item.answer, variationsText: item.variations.join("\n\n"), reviewStatus: item.reviewStatus });
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir a operação.";

export function ResponseWorkspace() {
  const [list, setList] = useState<ResponseTemplatesResponse | null>(null);
  const [filters, setFilters] = useState({ search: "", category: "", state: "active", reviewStatus: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [saved, setSaved] = useState<ResponseTemplate | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [panel, setPanel] = useState<Panel>("list");
  const heading = useRef<HTMLHeadingElement>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved ? toForm(saved) : emptyForm);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setListError("");
    const timer = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams({ search: filters.search, state: filters.state, page: String(filters.page) });
        if (filters.category) query.set("category", filters.category);
        if (filters.reviewStatus) query.set("reviewStatus", filters.reviewStatus);
        const result = await apiRequest<ResponseTemplatesResponse>(`/responses?${query}`, { signal: controller.signal });
        if (!controller.signal.aborted) {
          const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
          if (filters.page > lastPage) setFilters((previous) => ({ ...previous, page: lastPage }));
          else setList(result);
        }
      } catch (error) {
        if (!controller.signal.aborted) setListError(errorMessage(error));
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [filters, refresh]);

  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      const exit = event.target instanceof Element ? event.target.closest("button[data-panel-exit]") : null;
      if (exit) {
        if (!window.confirm("Há alterações não salvas. Deseja descartá-las e sair?")) { event.preventDefault(); event.stopPropagation(); }
        else setForm(saved ? toForm(saved) : emptyForm);
        return;
      }
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const target = new URL(link.href, window.location.href);
      if (target.pathname === window.location.pathname && target.search === window.location.search) return;
      if (!window.confirm("Há alterações não salvas. Deseja descartá-las e sair?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty, saved]);

  function filter(key: keyof typeof filters, value: string | number) { setFilters((previous) => ({ ...previous, [key]: value, ...(key !== "page" ? { page: 1 } : {}) })); }
  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((previous) => ({ ...previous, [key]: value,
      ...(key !== "reviewStatus" && previous.reviewStatus === "reviewed" ? { reviewStatus: "draft" as const } : {}) }));
    setNotice("");
  }
  function canLeave() { return !dirty || window.confirm("Há alterações não salvas. Deseja descartá-las?"); }
  function select(response: ResponseTemplate) {
    setSaved(response); setForm(toForm(response)); setConflict(false); setPanel("editor");
    window.setTimeout(() => heading.current?.focus(), 0);
  }
  function newResponse() {
    if (!canLeave()) return;
    setSaved(null); setForm(emptyForm); setError(""); setNotice(""); setConflict(false); setPanel("editor");
    window.setTimeout(() => heading.current?.focus(), 0);
  }
  async function open(id: string) {
    if (!canLeave()) return;
    setBusy(true); setError(""); setNotice("");
    try { select((await apiRequest<ResponseTemplateResponse>(`/responses/${id}`)).response); }
    catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }
  function mutationError(error: unknown) {
    if (error instanceof ApiError && error.status === 409) {
      setConflict(true); setError("Outra pessoa alterou este modelo. Seu texto foi preservado no formulário. Copie o que deseja manter e reabra a versão atual antes de salvar.");
    } else setError(errorMessage(error));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const input: ResponseTemplateInput = { title: form.title, category: form.category, answer: form.answer, reviewStatus: form.reviewStatus,
      questionExamples: form.questions.split("\n").map((text) => text.trim()).filter(Boolean),
      variations: form.variationsText.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean) };
    try {
      const result = await apiRequest<ResponseTemplateResponse>(saved ? `/responses/${saved.id}` : "/responses", {
        method: saved ? "PATCH" : "POST", body: JSON.stringify({ ...input, ...(saved ? { revision: saved.revision } : {}) }),
      });
      select(result.response); setNotice("Rascunho salvo. Nenhuma alteração foi enviada ao WhatsApp."); setRefresh((value) => value + 1);
    } catch (error) { mutationError(error); }
    finally { setBusy(false); }
  }
  async function duplicate() {
    if (!saved || dirty) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await apiRequest<ResponseTemplateResponse>(`/responses/${saved.id}/duplicate`, { method: "POST", body: JSON.stringify({ revision: saved.revision }) });
      select(result.response); setNotice("Cópia criada como rascunho. O modelo original foi preservado."); setRefresh((value) => value + 1);
    } catch (error) { mutationError(error); }
    finally { setBusy(false); }
  }
  async function toggleActive() {
    if (!saved || dirty) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await apiRequest<ResponseTemplateResponse>(`/responses/${saved.id}`, { method: "PATCH", body: JSON.stringify({ revision: saved.revision, isActive: !saved.isActive }) });
      select(result.response); setNotice(result.response.isActive ? "Modelo reativado nos rascunhos." : "Modelo desativado. Você pode encontrá-lo pelo filtro de desativados."); setRefresh((value) => value + 1);
    } catch (error) { mutationError(error); }
    finally { setBusy(false); }
  }

  return <div className="responses-page" data-panel={panel}>
    <div className="page-heading"><div><h1>Respostas</h1></div><button className="button create-content" onClick={newResponse} disabled={busy} aria-label="Nova resposta"><Icon name="plus" className="size-4" /><span>Nova resposta</span></button></div>
    <div className="draft-banner"><Icon name="lock" className="size-4 shrink-0" /><p>As edições ficam salvas no painel como rascunho. A publicação no WhatsApp será habilitada após a integração.</p><span className="badge">WhatsApp desconectado</span></div>
    <div className="mobile-editor-heading"><button className="icon-button" aria-label="Voltar aos modelos" onClick={() => setPanel("list")}><Icon name="back" className="size-5" /></button><strong>{form.title || "Nova resposta"}</strong></div>
    <nav className="workspace-tabs" aria-label="Áreas do editor">{([['editor', 'Editar'], ['preview', 'Prévia']] as const).map(([id, label]) => <button key={id} aria-label={label} aria-pressed={panel === id} onClick={() => setPanel(id)}>{label}{id === "editor" && dirty ? " •" : ""}</button>)}</nav>
    {error && <div className="feedback feedback-error" role="alert"><p>{error}</p>{conflict && saved && <button className="button-secondary mt-3" disabled={busy} onClick={() => void open(saved.id)}>Reabrir versão atual</button>}</div>}
    {notice && <p className="feedback" role="status">{notice}</p>}
    <div className="response-workspace" aria-busy={busy}>
      <section className={`response-list workspace-panel ${panel === "list" ? "mobile-visible" : ""}`} aria-labelledby="list-title">
        <div className="section-heading"><h2 id="list-title">Seus modelos</h2><span className="badge">{loading ? "…" : listError ? "—" : list?.total ?? 0}</span></div>
        <ContentFilters search={filters.search} label="Buscar modelos" value={filters} onSearch={(value) => filter("search", value)} onQuickFilter={(value) => setFilters((previous) => ({ ...previous, ...value, page: 1 }))}>
          <label><span className="sr-only">Filtrar categoria</span><select aria-label="Filtrar categoria" className="field" value={filters.category} onChange={(event) => filter("category", event.target.value)}><option value="">Todas as categorias</option>{list?.categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2"><label><span className="sr-only">Filtrar atividade</span><select aria-label="Filtrar atividade" className="field" value={filters.state} onChange={(event) => filter("state", event.target.value)}><option value="active">Ativos</option><option value="inactive">Desativados</option><option value="all">Todos</option></select></label><label><span className="sr-only">Filtrar revisão</span><select aria-label="Filtrar revisão" className="field" value={filters.reviewStatus} onChange={(event) => filter("reviewStatus", event.target.value)}><option value="">Toda revisão</option>{Object.entries(reviewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        </ContentFilters>
        <div className="model-list" aria-busy={loading}>
          {loading ? <p className="list-placeholder" role="status">Carregando modelos…</p> : listError ? <div className="list-placeholder" role="alert"><p>{listError}</p><button className="button-secondary mt-3" onClick={() => setRefresh((value) => value + 1)}>Tentar novamente</button></div> : !list?.items.length ? <div className="empty-list"><Icon name="responses" className="size-9" /><h3>{list?.total ? "Nenhum modelo nesta página" : "Nenhum modelo cadastrado"}</h3><p>Nenhum modelo encontrado. Crie uma resposta ou ajuste os filtros.</p><button className="text-action" disabled={busy} onClick={newResponse}>Criar resposta <Icon name="arrow" className="size-4" /></button></div> : <ul>{list.items.map((item) => <li key={item.id}><button className="model-item" disabled={busy} aria-current={saved?.id === item.id ? "true" : undefined} onClick={() => void open(item.id)}><span className="model-category">{item.category}</span><strong>{item.title}</strong><span className="model-meta"><span className={`review-dot ${item.reviewStatus}`} />{reviewLabels[item.reviewStatus]}{!item.isActive && " · Desativado"}</span></button></li>)}</ul>}
        </div>
        {list && list.total > list.pageSize && <div className="pagination"><button className="button-secondary" disabled={loading || filters.page <= 1} onClick={() => filter("page", filters.page - 1)}>Anterior</button><span>{filters.page} / {Math.ceil(list.total / list.pageSize)}</span><button className="button-secondary" disabled={loading || filters.page * list.pageSize >= list.total} onClick={() => filter("page", filters.page + 1)}>Próxima</button></div>}
      </section>

      <section className={`response-editor workspace-panel ${panel === "editor" ? "mobile-visible" : ""}`} aria-labelledby="editor-title">
        <div className="editor-heading"><h2 ref={heading} tabIndex={-1} id="editor-title">{saved ? saved.title : "Nova resposta"}</h2><div className="editor-heading-actions"><label><span className="sr-only">Estado de revisão</span><select aria-label="Estado de revisão" className="review-select" disabled={busy} value={form.reviewStatus} onChange={(event) => update("reviewStatus", event.target.value as ResponseReviewStatus)}>{Object.entries(reviewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="button-secondary preview-toggle" onClick={() => setPanel("preview")}>Prévia</button></div></div>
        <form onSubmit={save}>
          <fieldset disabled={busy} className="editor-fields">
            <div className="editor-basics"><label>Título do modelo<input className="field" required minLength={3} maxLength={120} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Ex.: Como funciona a primeira consulta" /></label><label>Categoria<input className="field" required maxLength={80} value={form.category} list="response-categories" onChange={(event) => update("category", event.target.value)} /><datalist id="response-categories">{list?.categories.map((category) => <option key={category} value={category} />)}</datalist></label></div>
            <label><span id="questions-label">Perguntas que esta resposta atende</span><textarea className="field" rows={2} maxLength={10020} value={form.questions} onChange={(event) => update("questions", event.target.value)} placeholder="Como é a primeira consulta?&#10;Gostaria de saber como funciona o atendimento." aria-labelledby="questions-label" aria-describedby="questions-help" /><span className="field-help" id="questions-help">Uma pergunta por linha. Até 20 exemplos de 500 caracteres.</span></label>
            <label><span id="answer-label">Resposta-base</span><textarea className="field answer-field" rows={6} required maxLength={6000} value={form.answer} onChange={(event) => update("answer", event.target.value)} placeholder="Texto da resposta" aria-labelledby="answer-label" aria-describedby="answer-help" /><span className="field-help field-counter" id="answer-help"><span>Use informações revisadas pela clínica.</span><span>{form.answer.length}/6000</span></span></label>
            <details className="variations-section" open={Boolean(form.variationsText)}><summary>Variações de resposta <span>Opcional</span></summary><label className="mt-4"><span id="variations-label">Textos alternativos</span><textarea className="field" rows={5} maxLength={60020} value={form.variationsText} onChange={(event) => update("variationsText", event.target.value)} aria-labelledby="variations-label" aria-describedby="variations-help" /><span id="variations-help" className="field-help">Separe variações por uma linha em branco. Até 10 textos de 6000 caracteres.</span></label></details>
            {saved && <VariationSuggestions key={`${saved.id}:${saved.revision}`} id={saved.id} revision={saved.revision} disabled={busy || dirty || conflict} onBusy={setBusy} onAdd={(text) => { const items = form.variationsText.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean); if (items.length >= 10) return false; update("variationsText", [...items, text].join("\n\n")); return true; }} />}
            <div className="editor-actions"><Link className="text-action" href="/simulador">Simular conteúdo salvo</Link><Link className="text-action" href="/configuracoes/versoes">Versões e ativação interna</Link></div>
            {saved && !saved.isActive && <p className="field-help">Este modelo está desativado. Reative-o para voltar à lista de ativos.</p>}
            {saved && <details className="editor-options"><summary>Mais ações</summary><div className="editor-actions"><button className="button-secondary" type="button" disabled={busy || dirty || conflict} onClick={() => void duplicate()}><Icon name="copy" className="size-4" />Duplicar</button><button className="text-action" type="button" disabled={busy || dirty || conflict} onClick={() => void toggleActive()}>{saved.isActive ? "Desativar" : "Reativar"}</button></div></details>}
            {dirty && saved && <p className="field-help">Salve suas alterações antes de duplicar ou alterar a atividade.</p>}
          </fieldset>
          <div className="editor-actions editor-save-bar"><span className={`save-state ${dirty ? "unsaved" : ""}`}>{dirty ? "Alterações não salvas" : saved ? "Salvo no painel" : "Novo rascunho"}</span><button className="button" type="submit" disabled={busy || conflict || Boolean(saved && !dirty)}>{busy ? "Aguarde…" : "Salvar rascunho"}</button></div>
        </form>
      </section>

      <aside className={`response-preview workspace-panel ${panel === "preview" ? "mobile-visible" : ""}`} aria-labelledby="preview-title"><div className="section-heading"><h2 id="preview-title">Prévia da conversa</h2><button className="button-secondary preview-toggle" onClick={() => setPanel("editor")}>Voltar a editar</button></div><span className="badge mb-3">Demonstrativa</span><div className="conversation"><div className="conversation-heading"><span className="avatar">LC</span><div><strong>Assistente da clínica</strong><span>Prévia de texto</span></div></div><div className="conversation-messages"><div className="message message-question">{form.questions.split("\n").find((text) => text.trim()) || "A pergunta de exemplo aparecerá aqui."}</div><div className={`message message-answer ${!form.answer ? "message-placeholder" : ""}`}>{form.answer || "Sua resposta aparecerá aqui conforme você escreve."}</div></div></div><p className="preview-note">Prévia estática, sem IA e sem envio de mensagens.</p><div className="publication-card"><Icon name="lock" className="size-5" /><h3>Publicação</h3><p>Disponível após a integração com o WhatsApp.</p><button className="button-secondary" disabled>Publicar no WhatsApp</button></div></aside>
    </div>
  </div>;
}
