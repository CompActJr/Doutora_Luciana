import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const directory = new URL("../n8n/workflows/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("equipe.manifest.json", directory), "utf8"));
assert.equal(manifest.status, "blocked-reference");
assert.equal(manifest.workflows.length, 8);
const ids = new Set(manifest.workflows.map((item) => item.id));
assert.equal(ids.size, 8);
let nodeCount = 0, toolCount = 0;
const harmless = new Set(["n8n-nodes-base.executeWorkflowTrigger", "n8n-nodes-base.set", "n8n-nodes-base.code", "n8n-nodes-base.if", "n8n-nodes-base.switch", "n8n-nodes-base.noOp", "n8n-nodes-base.convertToFile", "n8n-nodes-base.stopAndError"]);
function inspect(value, key = "") {
  assert.notEqual(key, "credentials", "Referências a credenciais não podem ser versionadas");
  assert.notEqual(key, "meta");
  assert.ok(!key.startsWith("cachedResult"));
  if (typeof value === "string") {
    for (const match of value.matchAll(/https?:\/\/[^\s"'<>]+/g)) assert.equal(new URL(match[0]).hostname, "example.invalid");
    for (const match of value.matchAll(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g)) assert.ok(match[0].endsWith("@example.invalid"));
    assert.ok(!/\b\d{10,16}\b/.test(value), "Contato ou identificador numérico não revisado");
    assert.ok(!/\b(?:sk|gsk)[-_][A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{12,}/.test(value), "Possível segredo");
  } else if (value && typeof value === "object") for (const [k, item] of Object.entries(value)) inspect(item, k);
}
for (const entry of manifest.workflows) {
  assert.match(entry.file, /^[a-z-]+\.json$/);
  const workflow = JSON.parse(await readFile(new URL(`equipe/${entry.file}`, directory), "utf8"));
  assert.equal(workflow.id, entry.id); assert.equal(workflow.active, false);
  assert.deepEqual(workflow.pinData, {}); assert.deepEqual(workflow.tags, []);
  assert.equal(workflow.nodes.length, entry.sourceNodes + 1);
  const names = new Set(workflow.nodes.map((node) => node.name));
  assert.equal(names.size, workflow.nodes.length);
  const guard = workflow.nodes.find((node) => node.type === "n8n-nodes-base.stopAndError");
  assert.ok(guard && !guard.disabled);
  assert.equal(workflow.connections[guard.name], undefined);
  for (const node of workflow.nodes) {
    if (!harmless.has(node.type)) assert.equal(node.disabled, true, `Ação externa habilitada em ${entry.file}`);
    if (["n8n-nodes-base.executeWorkflowTrigger", "n8n-nodes-base.webhook"].includes(node.type)) assert.deepEqual(workflow.connections[node.name], { main: [[{ node: guard.name, type: "main", index: 0 }]] });
    if (node.parameters.workflowId) { assert.ok(ids.has(node.parameters.workflowId.value)); toolCount++; }
  }
  for (const [name, outputs] of Object.entries(workflow.connections)) {
    assert.ok(names.has(name));
    for (const channels of Object.values(outputs)) for (const edges of channels) for (const edge of edges) assert.ok(names.has(edge.node), `Conexão sem destino em ${entry.file}`);
  }
  inspect(workflow); nodeCount += workflow.nodes.length;
}
assert.equal(toolCount, 7);
console.log(`Aprovado: 8 workflows inativos, ${nodeCount} nós, 7 referências internas; entradas bloqueadas, ações externas desabilitadas e dados privados removidos.`);
