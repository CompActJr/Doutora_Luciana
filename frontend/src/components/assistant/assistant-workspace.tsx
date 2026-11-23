"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { AssistantSettings, AssistantSettingsInput, AssistantSettingsResponse } from "@dra/contracts";
import { ApiError, apiRequest } from "@/lib/api";
import { confirmDiscard, useUnsavedChanges } from "@/lib/unsaved-changes";
import { Icon } from "@/components/ui/icon";

type Form = Omit<AssistantSettingsInput, "handoffTriggers"> & { triggers: string };
const emptyForm: Form = { displayName: "", introduction: "", tone: "", boundaries: "", triggers: "", handoffMessage: "", schedulingInstructions: "" };
const toForm = (settings: AssistantSettings): Form => ({ displayName: settings.displayName, introduction: settings.introduction, tone: settings.tone,
  boundaries: settings.boundaries, triggers: settings.handoffTriggers.join("\n"), handoffMessage: settings.handoffMessage, schedulingInstructions: settings.schedulingInstructions });
const message = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir a operação.";

export function AssistantWorkspace() {
  const [saved, setSaved] = useState<AssistantSettings | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(true);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [step, setStep] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [invalidField, setInvalidField] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved ? toForm(saved) : emptyForm);
  useUnsavedChanges(dirty, () => setForm(saved ? toForm(saved) : emptyForm));
  useEffect(() => {
    if (!invalidField) return;
    invalidField.focus(); invalidField.reportValidity(); setInvalidField(null);
  }, [invalidField, step]);

  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setError("");
    apiRequest<AssistantSettingsResponse>("/assistant-settings", { signal: controller.signal }).then(({ settings }) => {
      if (!controller.signal.aborted) { setSaved(settings); setForm(settings ? toForm(settings) : emptyForm); setLoaded(true); setConflict(false); }
    }).catch((error) => { if (!controller.signal.aborted) setError(message(error)); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [reload]);

  function update<K extends keyof Form>(key: K, value: Form[K]) { setForm((previous) => ({ ...previous, [key]: value })); setNotice(""); }
  function reopen() {
    if (!confirmDiscard(dirty)) return;
    setNotice(""); setReload((value) => value + 1);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = event.currentTarget.querySelector<HTMLInputElement | HTMLTextAreaElement>("input:invalid, textarea:invalid");
    if (invalid) {
      setStep(Number(invalid.closest<HTMLElement>("[data-step]")?.dataset.step ?? 0));
      setInvalidField(invalid); return;
    }
    setBusy(true); setError(""); setNotice("");
    const { triggers, ...content } = form;
    try {
      const { settings } = await apiRequest<AssistantSettingsResponse>("/assistant-settings", { method: "PUT", body: JSON.stringify({ ...content,
        handoffTriggers: triggers.split("\n").map((text) => text.trim()).filter(Boolean), revision: saved?.revision ?? 0 }) });
      if (!settings) throw new Error("Não foi possível confirmar o salvamento.");
      setSaved(settings); setForm(toForm(settings)); setConflict(false); setNotice("Configuração salva como rascunho. O atendimento no WhatsApp não foi alterado.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) { setConflict(true); setError("Outra pessoa salvou a configuração. Seu texto foi preservado. Copie o que deseja manter e reabra a versão atual."); }
      else setError(message(error));
    } finally { setBusy(false); }
  }

  function textField(key: Exclude<keyof Form, "displayName" | "triggers">, label: string, help: string, maxLength: number, rows = 3) {
    return <label><span id={`${key}-label`}>{label}</span><textarea className="field" required rows={rows} maxLength={maxLength} value={form[key]} onChange={(event) => update(key, event.target.value)} aria-labelledby={`${key}-label`} aria-describedby={`${key}-help`} /><span className="field-help" id={`${key}-help`}>{help}</span></label>;
  }

  const steps = [
    { title: "Identidade", hint: "Como a assistente se apresenta.", complete: Boolean(form.displayName.trim() && form.introduction.trim()) },
    { title: "Tom de voz", hint: "Escolha o estilo da conversa.", complete: Boolean(form.tone.trim()) },
    { title: "Limites", hint: "O que a assistente pode e não pode fazer.", complete: Boolean(form.boundaries.trim()) },
    { title: "Encaminhamento à equipe", hint: "Quando o atendimento precisa de uma pessoa.", complete: Boolean(form.triggers.trim() && form.handoffMessage.trim()) },
    { title: "Agendamento", hint: "Oriente o encaminhamento para marcar consultas.", complete: Boolean(form.schedulingInstructions.trim()) },
  ];
  const complete = steps.filter((item) => item.complete).length;
  return <div className="assistant-page">
    <div className="page-heading"><div><h1>Assistente</h1></div><button className="button assistant-header-save" form="assistant-form" disabled={busy || !loaded || conflict || !dirty}>Salvar rascunho</button></div>
    <div className="assistant-progress"><progress value={complete} max={5} aria-label="Etapas preenchidas" /><span>{complete} de 5 etapas preenchidas</span><span className={`badge ${dirty ? "badge-warning" : ""}`}>{dirty ? "Alterações não salvas" : saved ? "Rascunho salvo" : "Configuração inicial"}</span></div>
    <div className="draft-banner"><Icon name="lock" className="size-4 shrink-0" /><p>Salvar não ativa IA nem publica alterações no WhatsApp.</p></div>
    {error && <div className="feedback feedback-error" role="alert"><p>{error}</p><button className="button-secondary mt-3" disabled={busy} onClick={reopen}>{conflict ? "Reabrir versão atual" : "Tentar carregar novamente"}</button></div>}
    {notice && <p className="feedback" role="status">{notice}</p>}
    {busy && !loaded && <p role="status" className="mb-5 text-sm text-muted">Carregando configuração…</p>}
    <div className="assistant-workspace">
      <form id="assistant-form" onSubmit={save} noValidate aria-busy={busy}><fieldset disabled={busy || !loaded} className="assistant-sections assistant-timeline">
        {steps.map((item, index) => <section className={`assistant-step ${step === index ? "is-open" : ""}`} data-step={index} key={item.title}>
          <button className="assistant-step-heading" type="button" aria-expanded={step === index} aria-controls={`assistant-step-${index}`} onClick={() => setStep(index)}><span className={`step-number ${item.complete ? "complete" : ""}`}>{item.complete ? <Icon name="check" /> : index + 1}</span><span><strong>{item.title}</strong>{step !== index && index === 0 && form.displayName && <small>{form.displayName}</small>}</span><small>{item.complete ? "Preenchido" : "Pendente"}</small></button>
          <div id={`assistant-step-${index}`} className="response-editor assistant-step-body" hidden={step !== index}><div className="editor-heading"><div><h2>{item.title}</h2><p className="field-help">{item.hint}</p></div></div><div className="editor-fields">
          {index === 0 && <>
          <label>Nome da assistente<input className="field" required maxLength={80} value={form.displayName} onChange={(event) => update("displayName", event.target.value)} placeholder="Como a assistente deve se identificar" /></label>
          {textField("introduction", "Apresentação", "Como se apresentar no início da conversa. Até 2000 caracteres.", 2000)}
          </>}
          {index === 1 && <>
          <p className="field-help">Descreva a linguagem desejada, como acolhedora, formal ou objetiva.</p>
          {textField("tone", "Tom de voz", "Oriente a linguagem, o nível de formalidade e os cuidados com o texto. Até 2000 caracteres.", 2000)}
          </>}
          {index === 2 && textField("boundaries", "Limites e cuidados", "Defina o que deve ser encaminhado para avaliação profissional e o que a assistente não deve prometer. Até 4000 caracteres.", 4000, 5)}
          {index === 3 && <>
          <label><span id="triggers-label">Situações de encaminhamento</span><textarea className="field" rows={5} required maxLength={6020} value={form.triggers} onChange={(event) => update("triggers", event.target.value)} aria-labelledby="triggers-label" aria-describedby="triggers-help" /><span className="field-help" id="triggers-help">Uma situação por linha. De 1 a 20 situações, com até 300 caracteres cada.</span></label>
          {textField("handoffMessage", "Mensagem de encaminhamento", "Texto para acolher a pessoa e explicar que a equipe continuará o atendimento. Até 3000 caracteres.", 3000)}
          </>}
          {index === 4 && textField("schedulingInstructions", "Orientações de agendamento", "Use um link aprovado ou encaminhamento à equipe. A IA não consulta os horários da agenda neste incremento. Até 2000 caracteres.", 2000)}
          </div></div>
        </section>)}
        <div className="editor-actions assistant-step-actions"><button className="button-secondary" type="button" disabled={step === 0 || busy} onClick={() => setStep((value) => value - 1)}>Voltar</button>{step < 4 ? <button className="button" type="button" onClick={() => setStep((value) => value + 1)}>Continuar</button> : <button className="button" disabled={busy || !loaded || conflict || !dirty}>{busy ? "Aguarde…" : "Salvar rascunho"}</button>}</div>
        <button className="text-action assistant-discard" type="button" disabled={busy || !dirty} onClick={() => { if (confirmDiscard(dirty)) { setForm(saved ? toForm(saved) : emptyForm); setNotice(""); } }}>Descartar alterações</button>
      </fieldset></form>
      <button className="button-secondary assistant-preview-toggle" aria-expanded={showPreview} aria-controls="assistant-preview" onClick={() => setShowPreview((value) => !value)}>{showPreview ? "Ocultar prévia" : "Ver prévia dos textos"}</button>
      <aside id="assistant-preview" className={`assistant-preview ${showPreview ? "is-visible" : ""}`} aria-labelledby="assistant-preview-title"><div className="section-heading"><h2 id="assistant-preview-title">Prévia dos textos</h2><span className="badge">Demonstrativa</span></div><p className="preview-description">Sem IA e sem envio de mensagens.</p><div className="conversation"><div className="conversation-heading"><span className="avatar">LC</span><strong>{form.displayName || "Nome da assistente"}</strong></div><div className="conversation-messages"><div className="message message-answer">{form.introduction || "A apresentação aparecerá aqui."}</div><p className="field-help">AO ENCAMINHAR PARA A EQUIPE</p><div className="message message-answer">{form.handoffMessage || "A mensagem de encaminhamento aparecerá aqui."}</div></div></div><div className="publication-card"><Icon name="lock" className="size-5" /><h3>Publicação</h3><p>Disponível após a integração com o WhatsApp.</p><button className="button-secondary" disabled>Publicar no WhatsApp</button></div></aside>
    </div>
  </div>;
}
