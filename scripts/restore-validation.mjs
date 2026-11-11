import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const snapshot = (await readFile("backups/validation/recovered-path.txt", "utf8")).trim();
assert.match(snapshot, /^backups\/validation\/recovered\/var\/tmp\/dra-backup\.[A-Za-z0-9]+$/);
const recoveredEnv = await readFile(`${snapshot}/production.env`, "utf8");
await writeFile(".env.restore", recoveredEnv.replaceAll("18443", "20443").replaceAll("18567", "20567"), { mode: 0o600 });
function docker(args) {
  const result = spawnSync("docker", args, { stdio: "inherit" });
  assert.equal(result.status, 0, `Docker falhou: ${args[0]}`);
}
const compose = ["compose", "--env-file", ".env.restore", "-p", "dra-restore", "-f", "compose.yaml", "-f", "compose.prod.yaml", "-f", "compose.validation.yaml", "-f", "compose.restore.yaml"];
// Recusar sobrescrita: este teste exige volumes de restauração novos.
const existing = spawnSync("docker", ["volume", "ls", "--filter", "label=com.docker.compose.project=dra-restore", "--format", "{{.Name}}"], { encoding: "utf8" });
assert.equal(existing.status, 0);
assert.equal(existing.stdout.trim(), "", "Remova conscientemente um ensaio anterior antes de repetir a restauração.");
docker([...compose, "up", "-d", "--no-build", "--wait", "postgres"]);
for (const database of ["dra_app", "n8n"]) {
  docker(["cp", `${snapshot}/${database}.dump`, `dra-restore-postgres-1:/tmp/${database}.dump`]);
  docker([...compose, "exec", "-T", "postgres", "pg_restore", "-U", "postgres", "-d", database, "--exit-on-error", `/tmp/${database}.dump`]);
}
docker([...compose, "create", "--no-build", "n8n", "caddy"]);
docker(["run", "--rm", "--mount", `type=bind,source=${resolve(".")},target=/workspace`,
  "--mount", "type=volume,source=dra-restore_n8n_data,target=/restore-n8n",
  "--mount", "type=volume,source=dra-restore_caddy_data,target=/restore-caddy-data",
  "--mount", "type=volume,source=dra-restore_caddy_config,target=/restore-caddy-config",
  "dra-validation-tools:local", "bash", "infra/testing/restore-files.sh"]);
docker([...compose, "up", "-d", "--no-build", "--wait", "--wait-timeout", "180"]);
docker(["cp", "dra-restore-caddy-1:/data/caddy/pki/authorities/local/root.crt", "backups/validation/restore-root.crt"]);
assert.deepEqual(await readFile("backups/validation/restore-root.crt"), await readFile("backups/validation/caddy-root.crt"), "CA original deve ser recuperada");
console.log("Dois bancos, arquivos, configuração e CA restaurados em volumes novos.");
