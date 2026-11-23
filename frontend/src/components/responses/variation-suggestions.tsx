"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import type { AiStatusResponse, VariationsResponse } from "@dra/contracts";
import { apiRequest } from "@/lib/api";

export function VariationSuggestions({ id, revision, disabled, onBusy, onAdd }: { id: string; revision: number; disabled: boolean; onBusy: (value: boolean) => void; onAdd: (text: string) => boolean }) {
  const fieldId = useId();
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { const controller = new AbortController(); apiRequest<AiStatusResponse>("/ai/status", { signal: controller.signal }).then((status) => setAvailable(status.available)).catch(() => {}); return () => controller.abort(); }, []);
  async function generate() {
    setLoading(true); onBusy(true); setError("");
    try { const result = await apiRequest<VariationsResponse>(`/responses/${id}/variations`, { method: "POST", body: JSON.stringify({ revision }) }); setSuggestions(result.suggestions); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível sugerir variações."); }
    finally { setLoading(false); onBusy(false); }
  }
  return <div className="ai-suggestions"><p className="field-help">Sugestões por IA são editáveis e precisam de revisão. Adicioná-las ao formulário não salva nem publica.</p><button className="button-secondary mt-3" type="button" disabled={disabled || loading || !available} onClick={() => void generate()}>{loading ? "Gerando sugestões…" : "Sugerir variações com IA"}</button>{!available && <p className="field-help mt-3">A conexão OpenAI ainda não está disponível. <Link className="text-action" href="/configuracoes/integracoes">Ver integração</Link></p>}{error && <p className="feedback feedback-error mt-3" role="alert">{error}</p>}{suggestions.map((text, i) => <article key={i}><label htmlFor={`${fieldId}-${i}`}>Sugestão {i + 1}</label><textarea id={`${fieldId}-${i}`} className="field" rows={4} maxLength={6000} value={text} onChange={(e) => setSuggestions((items) => items.map((item, index) => index === i ? e.target.value : item))} /><button type="button" className="text-action mt-3" disabled={loading || !text.trim()} onClick={() => { if (onAdd(text.trim())) setSuggestions((items) => items.filter((_, index) => index !== i)); else setError("Limite de 10 variações. Remova uma antes de adicionar outra."); }}>Adicionar ao rascunho</button></article>)}</div>;
}
