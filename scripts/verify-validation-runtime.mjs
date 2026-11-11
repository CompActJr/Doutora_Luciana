import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const restored = process.argv.includes("--restored");
const project = restored ? "dra-restore" : "dra-validation";
const env = Object.fromEntries((await readFile(restored ? ".env.restore" : ".env.validation", "utf8")).trim().split(/\r?\n/).map(line => line.split(/=(.*)/s).slice(0, 2)));
function docker(args, options = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", ...options });
  assert.equal(result.status, 0, `Docker ${args[0]} falhou; inspecione o ambiente de ensaio.`);
  return result.stdout.trim();
}
const sql = (database, query) => docker(["exec", "-i", `${project}-postgres-1`, "psql", "-U", "postgres", "-d", database, "-At", "-v", "ON_ERROR_STOP=1"], { input: query });
assert.equal(sql("dra_app", 'SELECT count(*) FROM public."user";'), "2");
assert.equal(sql("dra_app", 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;'), "2");
assert.equal(sql("n8n", 'SELECT count(*) FROM credentials_entity;'), "1");
assert.equal(sql("n8n", 'SELECT count(*) FROM workflow_entity;'), "0");
for (const [user, database, password] of [["dra_app", "n8n", env.APP_DB_PASSWORD], ["dra_n8n", "dra_app", env.N8N_DB_PASSWORD]]) {
  const result = spawnSync("docker", ["exec", "-e", "PGPASSWORD", `${project}-postgres-1`, "psql", "-h", "127.0.0.1", "-U", user, "-d", database, "-c", "SELECT 1"], { encoding: "utf8", env: { ...process.env, PGPASSWORD: password } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /permission denied for database/);
}
const expected = JSON.parse(await readFile("backups/validation/credential.json", "utf8"))[0];
for (const mode of ["encrypted", "decrypted"]) {
  docker(["exec", "-u", "node", `${project}-n8n-1`, "n8n", "export:credentials", `--id=${expected.id}`, "--output=/tmp/validation-export.json", ...(mode === "decrypted" ? ["--decrypted"] : [])]);
  const exported = JSON.parse(docker(["exec", `${project}-n8n-1`, "cat", "/tmp/validation-export.json"]))[0];
  if (mode === "decrypted") assert.deepEqual(exported.data, expected.data);
  else { assert.equal(typeof exported.data, "string"); assert.ok(!exported.data.includes(expected.data.value)); }
}
docker(["exec", "-u", "0", `${project}-n8n-1`, "rm", "-f", "/tmp/validation-export.json", "/tmp/validation-credential.json"]);
assert.equal(docker(["exec", `${project}-n8n-1`, "cat", "/home/node/.n8n/validation-marker"]), "validation-persistent-data");
const networkNames = new Set();
const cookies = Object.values(JSON.parse(await readFile("backups/validation/sessions.json", "utf8")));
const sensitive = [...Object.entries(env).filter(([key]) => /PASSWORD|SECRET|ENCRYPTION_KEY|TOKEN/.test(key)).map(([, value]) => value), ...cookies];
for (const service of ["postgres", "backend", "frontend", "n8n", "caddy"]) {
  const inspect = JSON.parse(docker(["inspect", `${project}-${service}-1`]))[0];
  if (service === "caddy") assert.equal(inspect.State.Running, true, service);
  else assert.equal(inspect.State.Health?.Status, "healthy", service);
  if (service !== "caddy") assert.ok(Object.values(inspect.NetworkSettings.Ports ?? {}).every(value => value === null), `${service}: não deve publicar portas`);
  else for (const binding of Object.values(inspect.NetworkSettings.Ports ?? {}).flat().filter(Boolean)) assert.equal(binding.HostIp, "127.0.0.1");
  if (["backend", "frontend"].includes(service)) {
    assert.equal(inspect.Config.User, "node");
    assert.deepEqual(inspect.HostConfig.CapDrop, ["ALL"]);
    assert.ok(inspect.Mounts.every(mount => mount.Type !== "bind"));
  }
  if (service === "n8n") for (const name of Object.keys(inspect.NetworkSettings.Networks)) networkNames.add(name);
  const result = spawnSync("docker", ["logs", `${project}-${service}-1`], { encoding: "utf8" });
  assert.equal(result.status, 0);
  for (const value of sensitive.filter(value => value.length >= 16)) assert.ok(!(result.stdout + result.stderr).includes(value), `${service}: logs devem omitir segredos`);
}
for (const name of networkNames) assert.equal(JSON.parse(docker(["network", "inspect", name]))[0].Internal, true);
console.log(`${project}: dados, migrations, isolamento dos bancos, credencial n8n decifrada, arquivos, portas, execução sem root e ausência dos segredos de teste nos logs aprovados.`);
