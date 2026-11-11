import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, copyFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("gera todos os segredos e não sobrescreve uma configuração existente", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "dra-env-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "scripts"));
  await copyFile(new URL("../../.env.example", import.meta.url), path.join(root, ".env.example"));
  const script = path.join(root, "scripts/setup-env.mjs");
  await copyFile(new URL("../setup-env.mjs", import.meta.url), script);
  const created = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(created.status, 0);
  const content = await readFile(path.join(root, ".env"), "utf8");
  const values = Object.fromEntries(content.split(/\r?\n/).filter((line) => /^[A-Z0-9_]+=/.test(line)).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const names = ["POSTGRES_PASSWORD", "APP_DB_PASSWORD", "N8N_DB_PASSWORD", "N8N_ENCRYPTION_KEY", "BETTER_AUTH_SECRET", "N8N_SERVICE_TOKEN"];
  for (const name of names) {
    assert.match(values[name], /^[a-f0-9]{64}$/);
    assert.ok(!created.stdout.includes(values[name]));
  }
  assert.equal(new Set(names.map((name) => values[name])).size, names.length);
  assert.ok(values.DATABASE_URL.includes(values.APP_DB_PASSWORD));
  const repeated = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.notEqual(repeated.status, 0);
  assert.equal(await readFile(path.join(root, ".env"), "utf8"), content);
});
