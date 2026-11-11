import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

function configuration(environment) {
  const result = spawnSync("docker", ["compose", "--env-file", ".env.example", "-f", "compose.yaml", "-f", `compose.${environment}.yaml`, "config", "--format", "json"], {
    encoding: "utf8",
    env: { ...process.env,
      POSTGRES_PASSWORD: "test-postgres", APP_DB_PASSWORD: "test-app", N8N_DB_PASSWORD: "test-n8n",
      N8N_ENCRYPTION_KEY: "test-encryption-key", ACME_EMAIL: "infra@example.invalid",
      PANEL_DOMAIN: "painel.example.invalid", N8N_DOMAIN: "n8n.example.invalid",
      BETTER_AUTH_SECRET: "test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  });
  assert.equal(result.status, 0, "Docker Compose precisa validar a configuração sem erros.");
  return JSON.parse(result.stdout);
}

test("produção publica somente Caddy e mantém credenciais e banco separados", () => {
  const config = configuration("prod");
  for (const service of ["postgres", "backend", "frontend", "n8n", "migrate"]) {
    assert.equal(config.services[service].ports?.length ?? 0, 0, service);
  }
  assert.equal(config.networks.database.internal, true);
  assert.equal(config.services.backend.depends_on.migrate.condition, "service_completed_successfully");
  assert.equal(config.services.n8n.environment.DB_POSTGRESDB_USER, "dra_n8n");
  assert.equal(config.services.n8n.environment.N8N_SECURE_COOKIE, "true");
  assert.equal(config.services.backend.environment.N8N_DB_PASSWORD, undefined);
  assert.equal(config.services.frontend.environment.DATABASE_URL, undefined);
  assert.equal(config.services.n8n.environment.EXECUTIONS_DATA_SAVE_ON_SUCCESS, "none");
  for (const service of Object.values(config.services)) assert.ok(!service.image.endsWith(":latest"));
});

test("desenvolvimento publica portas somente na interface local", () => {
  const config = configuration("dev");
  assert.equal(config.networks.database.internal ?? false, false);
  for (const service of Object.values(config.services)) {
    for (const port of service.ports ?? []) assert.equal(port.host_ip, "127.0.0.1");
  }
});
