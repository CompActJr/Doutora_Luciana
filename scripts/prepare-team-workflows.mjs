import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Entrada privada, nunca executada: exports originais são somente dados.
const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error("Informe o diretório privado com os oito JSONs extraídos. Os originais não são modificados.");
const root = fileURLToPath(new URL("../", import.meta.url));
const destination = path.join(root, "n8n/workflows/equipe");
const specs = [
  ["agendar-consulta", /^Ferramenta - agendar consulta$/],
  ["cancelar-consulta", /^Ferramenta - cancelar consulta$/],
  ["confirmar-presenca", /^Ferramenta - confirmar presença$/],
  ["consultar-consulta", /^Ferramenta - consultar consulta$/],
  ["encaminhar-duvida", /^Ferramenta - encaminhar dúvida$/],
  ["remarcar-consulta", /^Ferramenta - remarcar\s+consulta$/],
  ["horarios-livres", /^Horarios livres$/],
  ["chatbot-whatsapp", /^Protótipo - ChatBot WhatsApp/],
];
const id = (label) => createHash("sha256").update(`dra-equipe-base-2026-11-13:${label}`).digest("hex").slice(0, 16);
const sources = [];
for (const file of await readdir(sourceDirectory)) {
  if (!file.endsWith(".json")) continue;
  const value = JSON.parse((await readFile(path.join(sourceDirectory, file), "utf8")).replace(/^\uFEFF/, ""));
  if (value && Array.isArray(value.nodes) && value.connections) sources.push(value);
}
if (sources.length !== 8) throw new Error("Esperados exatamente oito workflows; nenhuma saída foi gravada.");
const selected = specs.map(([slug, pattern]) => {
  const matches = sources.filter((source) => pattern.test(source.name));
  if (matches.length !== 1) throw new Error(`Workflow ausente ou ambíguo: ${slug}`);
  return { slug, source: matches[0], id: id(slug) };
});
const workflowIds = new Map(selected.map((entry) => [entry.source.id, entry.id]));
const resourceKeys = new Set(["calendar", "documentId", "sheetName", "dataTableId"]);
const harmless = new Set(["n8n-nodes-base.executeWorkflowTrigger", "n8n-nodes-base.set", "n8n-nodes-base.code", "n8n-nodes-base.if", "n8n-nodes-base.switch", "n8n-nodes-base.noOp", "n8n-nodes-base.convertToFile"]);
const blockedPrompt = "BASE DE REFERÊNCIA BLOQUEADA. Substituir o prompt original pela configuração revisada e versionada do painel. Não executar atendimento, agenda ou envios externos nesta cópia.";

function sanitize(value, key = "") {
  if (key === "credentials" || key === "pinData" || key === "meta" || key.startsWith("cachedResult")) return undefined;
  if (key === "systemMessage") return blockedPrompt;
  if (key === "jsonExample") return JSON.stringify({ data: "2030-01-01" });
  if (resourceKeys.has(key)) return { __rl: true, value: `RECONFIGURAR_${key.toUpperCase()}`, mode: "id" };
  if (key === "workflowId") {
    const originalId = typeof value === "object" ? value.value : value;
    const target = workflowIds.get(originalId);
    if (!target) throw new Error("Referência a subworkflow fora do pacote. Revisão manual necessária.");
    return { __rl: true, value: target, mode: "id" };
  }
  if (typeof value === "string") return value
    .replace(/https?:\/\/[^\s"'<>]+/g, "https://example.invalid/RECONFIGURAR")
    .replace(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "contato@example.invalid")
    .replace(/\b\d{10,16}(?:@lid)?\b/g, "CONTATO_REMOVIDO")
    .replace(/\b(?:sk|gsk|AIza)[-_]?[A-Za-z0-9_-]{20,}\b/g, "SEGREDO_REMOVIDO");
  if (Array.isArray(value)) return value.map((item) => sanitize(item)).filter((item) => item !== undefined);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, item]) => [k, sanitize(item, k)]).filter(([, item]) => item !== undefined));
  return value;
}

const artifacts = [], manifest = [];
for (const entry of selected) {
  const { slug, source } = entry;
  const entryTargets = {};
  const nodes = source.nodes.map((original, index) => {
    if (original.type === "n8n-nodes-base.code" && /\b(?:fetch|require|process|eval|Function)\b|\$env|child_process/.test(original.parameters.jsCode)) throw new Error(`Código requer revisão adicional em ${slug}; nada foi executado.`);
    const node = {
      parameters: sanitize(original.parameters), id: id(`${slug}:node:${index}`), name: original.name,
      type: original.type, typeVersion: original.typeVersion, position: original.position,
      disabled: original.disabled === true || !harmless.has(original.type),
      notes: "Base da equipe, revisada para estudo. Ações externas bloqueadas e credenciais removidas.",
      notesInFlow: false,
    };
    for (const field of ["alwaysOutputData", "executeOnce", "retryOnFail", "maxTries", "waitBetweenTries", "onError", "continueOnFail"]) if (original[field] !== undefined) node[field] = original[field];
    if (original.type === "n8n-nodes-base.webhook") node.parameters.path = `dra-base-bloqueada-${slug}`;
    if (slug === "chatbot-whatsapp" && original.name === "If") {
      node.parameters.conditions.conditions = [{ leftValue: "={{ false }}", rightValue: "", operator: { type: "boolean", operation: "true", singleValue: true } }];
    }
    return node;
  });
  const connections = structuredClone(source.connections);
  const guardName = "BLOQUEIO - base para integração";
  if (nodes.some((node) => node.name === guardName)) throw new Error("Nome de bloqueio já existente.");
  const triggers = nodes.filter((node) => ["n8n-nodes-base.executeWorkflowTrigger", "n8n-nodes-base.webhook"].includes(node.type));
  if (triggers.length !== 1) throw new Error(`Entrada não reconhecida em ${slug}.`);
  for (const trigger of triggers) {
    entryTargets[trigger.name] = (connections[trigger.name]?.main ?? []).flat().map((edge) => edge.node);
    connections[trigger.name] = { main: [[{ node: guardName, type: "main", index: 0 }]] };
  }
  nodes.push({ parameters: { errorMessage: blockedPrompt }, id: id(`${slug}:guard`), name: guardName, type: "n8n-nodes-base.stopAndError", typeVersion: 1, position: [triggers[0].position[0] + 260, triggers[0].position[1] - 180], disabled: false });
  artifacts.push({ slug, workflow: {
    id: entry.id, name: `[BASE BLOQUEADA] ${source.name}`, active: false, nodes, connections,
    settings: { executionOrder: "v1", timezone: "America/Sao_Paulo", saveDataSuccessExecution: "none", saveDataErrorExecution: "none", saveManualExecutions: false },
    pinData: {}, tags: [],
  } });
  manifest.push({ file: `${slug}.json`, id: entry.id, sourceNodes: source.nodes.length, importedNodes: nodes.length, disabledNodes: nodes.filter((node) => node.disabled).length, entryTargets });
}
// Validação antes de gravar: não deixar o pacote parcialmente revisado.
for (const { workflow } of artifacts) {
  const text = JSON.stringify(workflow);
  for (const source of sources) {
    const privateValues = [source.id, source.meta?.instanceId, ...source.nodes.flatMap((node) => Object.values(node.credentials ?? {}).flatMap((credential) => [credential.id, credential.name]))];
    if (privateValues.some((value) => typeof value === "string" && value.length >= 8 && text.includes(value))) throw new Error("Uma referência privada permaneceu no resultado. Revise a entrada local.");
  }
}
await mkdir(destination, { recursive: true });
for (const { slug, workflow } of artifacts) await writeFile(path.join(destination, `${slug}.json`), `${JSON.stringify(workflow, null, 2)}\n`);
await writeFile(path.join(root, "n8n/workflows/equipe.manifest.json"), `${JSON.stringify({ schemaVersion: 1, status: "blocked-reference", preparedOn: "2026-11-13", workflows: manifest }, null, 2)}\n`);
console.log(`Preparadas ${artifacts.length} cópias bloqueadas, sem credenciais ou dados fixados. Originais preservados.`);
