"use client";
import { useEffect, useState } from "react";
import type { AiStatusResponse } from "@dra/contracts";
import { apiRequest } from "@/lib/api";
import { CalendarIntegrationCard } from "@/components/calendar/connection-panel";
import { Icon } from "@/components/ui/icon";

export function IntegrationsWorkspace({ admin = false }: { admin?: boolean }) {
  const [status, setStatus] = useState<AiStatusResponse | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { const controller = new AbortController(); setStatus(null); setError(""); apiRequest<AiStatusResponse>("/ai/status", { signal: controller.signal }).then(setStatus).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); }); return () => controller.abort(); }, [refresh]);
  return <div><div className="page-heading"><div><h1>Integrações</h1></div></div>{error && <p className="feedback feedback-error" role="alert">{error}</p>}<div className="integrations-grid">
    <section className="content-card"><div className="integration-heading"><Icon name="sparkle" /><div><h2>IA · OpenAI</h2><span className="field-help">Simulador e sugestões de variações</span></div></div>{status ? <><p className={`badge ${status.available ? "badge-success" : ""}`} role="status">{status.available ? "Configurada no servidor" : "Ainda não configurada"}</p>{status.available && <p className="integration-value"><span>Modelo</span><strong>{status.model}</strong></p>}<p className="field-help">{status.available ? "O estado da configuração não comprova saldo e acesso ao modelo." : "A demonstração sem IA continua disponível."}</p></> : !error && <p role="status">Consultando conexão…</p>}<button className="button-secondary mt-4" onClick={() => setRefresh((v) => v + 1)}>Atualizar estado</button></section>
    {admin && <CalendarIntegrationCard />}
    <section className="content-card integration-deferred"><div className="integration-heading"><Icon name="responses" /><div><h2>WhatsApp e n8n</h2><span className="field-help">Atendimento real aos pacientes</span></div></div><span className="badge">Etapa 3 · Adiada</span><p className="field-help">Ativar uma versão interna não envia mensagens ou altera o bot.</p><button disabled className="button-secondary mt-4">Publicar no WhatsApp</button></section>
  </div></div>;
}
