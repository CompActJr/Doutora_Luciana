import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const calendarMode = process.argv.includes("--calendar");
const designMode = process.argv.includes("--design");
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { throw new Error("Disponibilize Playwright e Chromium para este ensaio. Opcional: PLAYWRIGHT_PACKAGE_JSON e PLAYWRIGHT_EXECUTABLE_PATH. Nenhuma instalação ou build é executada pelo runner."); }
const { createDatabase } = await import(pathToFileURL(path.join(root, "backend/src/plugins/database.ts")));
const { createUser } = await import(pathToFileURL(path.join(root, "backend/src/modules/users/service.ts")));
process.loadEnvFile(path.join(root, ".env"));
const connection = new URL(process.env.DATABASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(connection.hostname)); assert.equal(connection.pathname, "/dra_app");
const databaseName = `dra_auth_test_ui_${randomUUID().replaceAll("-", "")}`;
connection.pathname = `/${databaseName}`;
const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: connection.toString(), BETTER_AUTH_SECRET: randomBytes(32).toString("hex"), APP_ORIGIN: "http://localhost:3100", API_INTERNAL_URL: "http://127.0.0.1:3101", HOST: "127.0.0.1", PORT: "3101", SMTP_HOST: "", SMTP_FROM: "", SMTP_USER: "", SMTP_PASSWORD: "", OPENAI_API_KEY: "", OPENAI_MODEL: "" };
// Configuração fictícia só no servidor de ensaio, nunca no ambiente de desenvolvimento.
Object.assign(env, { TEST_CALENDAR_BROWSER: calendarMode ? "true" : "false", GOOGLE_CALENDAR_CLIENT_ID: calendarMode ? "fixture-client" : "", GOOGLE_CALENDAR_CLIENT_SECRET: calendarMode ? "fixture-secret" : "", GOOGLE_CALENDAR_TOKEN_KEY: calendarMode ? randomBytes(32).toString("hex") : "" });
const compose = ["compose", "--env-file", ".env", "-f", "compose.yaml", "-f", "compose.dev.yaml"];
const docker = (args) => execFileSync("docker", [...compose, ...args], { cwd: root, stdio: "pipe", windowsHide: true });
let database, backend, frontend, browser, page, created = false;
const checks = [], errors = [], external = [];
const pass = (text) => { checks.push(text); console.log("CHECK:", text); };
function server(args, cwd, environment) {
  const child = spawn(process.execPath, args, { cwd, env: environment, windowsHide: true, stdio: ["ignore", "ignore", "ignore"] });
  return child;
}
async function ready(url) {
  const until = Date.now() + 120000;
  while (Date.now() < until) { try { if ((await fetch(url, { signal: AbortSignal.timeout(5000) })).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 500)); }
  throw new Error(`Servidor de ensaio indisponível: ${url}`);
}
// Não reutilizar um servidor de outro trabalho nas portas do ensaio.
for (const port of [3100, 3101]) {
  const { createServer } = await import("node:net");
  await new Promise((resolve, reject) => { const probe = createServer(); probe.once("error", () => reject(new Error(`Porta ${port} ocupada; encerre somente o servidor de ensaio responsável.`))); probe.listen(port, "127.0.0.1", () => probe.close(resolve)); });
}
try {
  docker(["up", "-d", "--no-build", "--wait", "postgres"]);
  docker(["exec", "-T", "postgres", "createdb", "-U", "postgres", "-O", "dra_app", databaseName]); created = true;
  execFileSync(process.execPath, [path.join(root, "backend/node_modules/prisma/build/index.js"), "migrate", "deploy"], { cwd: path.join(root, "backend"), env, stdio: "pipe", windowsHide: true });
  database = createDatabase(env.DATABASE_URL);
  const password = randomBytes(24).toString("hex");
  for (const role of ["admin", "editor"]) await createUser(database, { name: `Pessoa fictícia ${role}`, email: `browser-${role}@example.invalid`, password, role });
  const template = await database.responseTemplate.create({ data: { title: "Primeira consulta fictícia", category: "Teste", questionExamples: ["Como funciona a primeira consulta?"], answer: "A consulta fictícia começa com uma conversa.", reviewStatus: "reviewed" } });
  await database.knowledgeEntry.create({ data: { title: "Clínica fictícia", category: "Teste", content: "Dados exclusivamente fictícios.", reviewStatus: "reviewed" } });
  await database.assistantSettings.create({ data: { id: "clinic", displayName: "Assistente fictícia", introduction: "Olá!", tone: "Acolhedor", boundaries: "Sem diagnósticos", handoffTriggers: ["quero ajuda humana"], handoffMessage: "Procure a equipe fictícia.", schedulingInstructions: "Sem prometer horários." } });
  backend = server(["--import", "tsx", "tests/fixtures/content-browser-server.ts"], path.join(root, "backend"), env);
  await copyFile(path.join(root, "frontend/tsconfig.json"), path.join(root, "frontend/tsconfig.browser-test.json"));
  frontend = server([path.join(root, "frontend/node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3100"], path.join(root, "frontend"), { ...env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", DRA_BROWSER_TEST: "true", PORT: "3100" });
  await ready("http://127.0.0.1:3101/api/v1/ready"); await ready("http://localhost:3100/login");
  browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}), headless: true });
  const context = await browser.newContext({ viewport: { width: 1536, height: 1050 } });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => { if (message.type() === "error" && /Encountered two children|hydration|In HTML,|Cannot update a component/i.test(message.text())) errors.push(message.text()); });
  context.on("request", (request) => { const url = new URL(request.url()); if (["http:", "https:"].includes(url.protocol) && !["localhost", "127.0.0.1"].includes(url.hostname) && !(calendarMode && url.hostname === "accounts.google.com")) external.push(url.origin); });
  async function login(role) { await page.goto("http://localhost:3100/login"); await page.getByLabel("E-mail", { exact: true }).fill(`browser-${role}@example.invalid`); await page.getByLabel("Senha", { exact: true }).fill(password); await page.getByRole("button", { name: "Entrar", exact: true }).click(); await page.waitForURL("**/respostas"); }
  async function navigate(name, pathname) {
    if (page.viewportSize().width <= 900 && (pathname.startsWith("/configuracoes") || pathname === "/agenda")) {
      await page.getByRole("link", { name: "Mais", exact: true }).click(); await page.waitForURL("**/mais");
    } else if (page.viewportSize().width > 900 && pathname.startsWith("/configuracoes")) {
      const settings = page.locator(".nav-settings"); if (!(await settings.evaluate((el) => el.open))) await settings.locator("summary").click();
    }
    await page.getByRole("link", { name, exact: true }).first().click(); await page.waitForURL(`**${pathname}`);
  }
  if (calendarMode) {
    const { runCalendarBrowserChecks } = await import("./testing/calendar-browser-checks.mjs");
    await runCalendarBrowserChecks({ page, context, database, root, login, pass });
  } else if (designMode) {
    const { runDesignBrowserChecks } = await import("./testing/design-browser-checks.mjs");
    await runDesignBrowserChecks({ page, database, root, login, navigate, pass });
  } else {
  await login("admin");
  await navigate("Versões e histórico", "/configuracoes/versoes");
  await page.getByLabel("Descrição da versão").fill("Primeira versão fictícia");
  page.once("dialog", (dialog) => dialog.dismiss()); await page.getByRole("link", { name: "Simulador", exact: true }).click(); assert.equal(new URL(page.url()).pathname, "/configuracoes/versoes");
  await page.getByLabel("Revisei o conteúdo", { exact: false }).check();
  await page.getByRole("button", { name: "Criar e ativar versão interna" }).click(); await page.getByRole("status").filter({ hasText: "Versão interna criada" }).waitFor();
  const first = await database.contentVersion.findFirstOrThrow(); assert.equal(await database.contentVersion.count(), 1); pass("Admin cria versão completa; proteção de descrição não salva");
  await database.responseTemplate.update({ where: { id: template.id }, data: { answer: "Rascunho atualizado para teste.", revision: { increment: 1 } } });
  await page.getByRole("button", { name: /Versão 1.*Ativa internamente/ }).click();
  await page.getByText("Respostas (1)", { exact: true }).click(); await page.getByText(template.answer, { exact: true }).waitFor();
  assert.equal((await database.contentVersion.findUniqueOrThrow({ where: { id: first.id } })).fingerprint, first.fingerprint); pass("Histórico mantém conteúdo anterior depois de editar rascunho");
  await page.getByLabel("Descrição da versão").fill("Prévia antiga fictícia"); await page.getByLabel("Revisei o conteúdo", { exact: false }).check(); await page.getByRole("button", { name: "Criar e ativar versão interna" }).click(); await page.locator("#panel-content [role=alert]").waitFor();
  await page.getByRole("button", { name: "Atualizar prévia" }).click(); await page.locator("#panel-content [role=alert]").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Criar e ativar versão interna" }).click(); await page.getByRole("status").filter({ hasText: "Versão interna criada" }).waitFor(); assert.equal(await database.contentVersion.count(), 2); pass("Prévia obsoleta é rejeitada e pode ser atualizada");
  await page.getByRole("button", { name: /Versão 1.*Primeira versão fictícia/ }).click();
  page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Restaurar em nova versão interna" }).click(); await page.getByRole("status").filter({ hasText: "Restauração criada" }).waitFor();
  assert.equal(await database.contentVersion.count(), 3); assert.equal((await database.responseTemplate.findUniqueOrThrow({ where: { id: template.id } })).answer, "Rascunho atualizado para teste."); pass("Restauração cria nova versão e preserva rascunho");
  await navigate("Simulador", "/simulador"); await page.getByLabel("Conteúdo para testar").selectOption(first.id); await page.getByRole("button", { name: "Iniciar conversa", exact: true }).click(); await page.getByLabel("Mensagem de teste").waitFor();
  await page.getByLabel("Mensagem de teste").fill("Como funciona a primeira consulta?"); await page.getByRole("button", { name: "Testar resposta", exact: true }).click(); await page.getByRole("log").getByText(template.answer, { exact: true }).waitFor();
  await page.getByRole("log").getByText("Conteúdos fornecidos como contexto").click(); await page.getByRole("log").getByText("Resposta: Primeira consulta fictícia").waitFor(); pass("Simulação demonstrativa identifica modo e usa versão selecionada");
  await page.getByLabel("Mensagem de teste").fill("quero ajuda humana"); await page.getByRole("button", { name: "Testar resposta", exact: true }).click(); await page.getByRole("log").getByText("Procure a equipe fictícia.").waitFor();
  await page.reload(); await page.getByRole("button", { name: /Como funciona a primeira consulta/ }).first().click(); await page.getByRole("log").getByText("Procure a equipe fictícia.").waitFor(); pass("Conversa persistida e encaminhamento humano demonstrativo");
  await page.getByLabel("Conteúdo para testar").selectOption(""); await page.getByRole("button", { name: "Iniciar conversa", exact: true }).click(); await page.getByLabel("Mensagem de teste").fill("Como funciona a primeira consulta?"); await page.getByRole("button", { name: "Testar resposta", exact: true }).click(); await page.getByRole("log").getByText("Rascunho atualizado para teste.", { exact: true }).waitFor(); pass("Simulação de rascunhos separada da versão salva");
  await page.getByLabel("Tipo de simulação").selectOption("openai"); await page.getByRole("button", { name: "Iniciar conversa", exact: true }).click(); await page.getByLabel("Mensagem de teste").fill("Como funciona a consulta?"); await page.getByRole("button", { name: "Testar resposta", exact: true }).click(); await page.getByRole("log").getByText("Resposta gerada pela fixture local de teste, sem OpenAI real.", { exact: true }).waitFor(); pass("Fluxo de IA exercitado com provedor fictício isolado");
  await page.getByLabel("Mensagem de teste").fill("Texto ainda não enviado"); page.once("dialog", (dialog) => dialog.dismiss()); await page.getByRole("link", { name: "Respostas", exact: true }).click(); assert.equal(new URL(page.url()).pathname, "/simulador");
  await page.getByLabel("Mensagem de teste").fill("");
  const directory = path.join(root, "backups/validation/stage2-final"); await mkdir(directory, { recursive: true }); await page.screenshot({ path: path.join(directory, "simulator-desktop.png"), fullPage: true });
  await navigate("Respostas", "/respostas"); await page.getByRole("button", { name: /Primeira consulta fictícia/ }).click();
  await page.getByRole("button", { name: "Sugerir variações com IA", exact: true }).click(); await page.getByLabel("Sugestão 1", { exact: true }).fill("Variação revisável editada no formulário."); await page.getByRole("button", { name: "Adicionar ao rascunho", exact: true }).click();
  assert.equal(await page.getByLabel("Estado de revisão").inputValue(), "draft"); assert.equal((await database.responseTemplate.findUniqueOrThrow({ where: { id: template.id } })).variations.length, 0);
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click(); await page.getByRole("status").filter({ hasText: "Rascunho salvo" }).waitFor(); assert.deepEqual((await database.responseTemplate.findUniqueOrThrow({ where: { id: template.id } })).variations, ["Variação revisável editada no formulário."]); pass("Sugestão de IA editável exige salvar rascunho e invalida revisão");
  for (const [name, pathname] of [["Respostas", "/respostas"], ["Base de conhecimento", "/conhecimento"], ["Assistente", "/assistente"], ["Simulador", "/simulador"], ["Versões e histórico", "/configuracoes/versoes"], ["Integrações", "/configuracoes/integracoes"]]) {
    await navigate(name, pathname);
    await page.getByRole("heading", { level: 1 }).waitFor();
    for (const width of [320, 390, 768, 1024]) { await page.setViewportSize({ width, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} em ${width}px`); }
    await page.setViewportSize({ width: 1536, height: 1050 });
  } pass("Todas as áreas navegam em desktop e em 320/390/768/1024px sem overflow");
  await navigate("Versões e histórico", "/configuracoes/versoes"); await page.getByText("Revise os 1 conteúdos ativos", { exact: false }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Criar e ativar versão interna" }).isDisabled(), true);
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(directory, "versions-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1536, height: 1050 }); await page.screenshot({ path: path.join(directory, "versions-desktop.png"), fullPage: true }); pass("Ativação bloqueada para conteúdo pendente de revisão");
  await navigate("Simulador", "/simulador"); await page.waitForFunction(() => [...document.querySelectorAll('.content-form select')].length === 2 && [...document.querySelectorAll('.content-form select')].every((element) => !element.disabled)); await page.getByLabel("Conteúdo para testar").focus(); await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => document.activeElement.closest("label")?.textContent?.includes("Tipo de simulação")), true);
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(directory, "simulator-mobile.png"), fullPage: true }); pass("Campos do simulador acessíveis por teclado e capturas desktop/celular");
  await page.getByRole("link", { name: "Mais", exact: true }).click(); await page.waitForURL("**/mais"); await page.getByRole("button", { name: "Sair", exact: true }).click(); await page.waitForURL("**/login"); await login("editor");
  assert.equal(await page.getByRole("link", { name: "Usuários e acessos" }).count(), 0);
  await navigate("Versões e histórico", "/configuracoes/versoes"); await page.getByText("Somente a administradora pode ativar ou restaurar.", { exact: false }).waitFor(); assert.equal(await page.getByRole("button", { name: "Criar e ativar versão interna" }).count(), 0);
  await navigate("Simulador", "/simulador"); await page.getByText("Nenhuma conversa de teste.", { exact: true }).waitFor(); await page.getByRole("button", { name: "Iniciar conversa", exact: true }).click(); await page.getByLabel("Mensagem de teste").waitFor(); pass("Editor consulta versões e simula sem acesso administrativo ou conversas alheias");
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  for (const button of await page.getByRole("button", { name: "Publicar no WhatsApp", exact: true }).all()) assert.equal(await button.isDisabled(), true);
  pass("Sem erros JavaScript nem requisições externas no navegador; nenhum envio real");
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log(JSON.stringify({ passed: checks.length, checks, screenshots: calendarMode ? "backups/validation/calendar" : designMode ? "backups/validation/design" : "backups/validation/stage2-final", provider: "fixture local, nenhuma chamada OpenAI ou Google real" }, null, 2));
} catch (error) {
  if (page) { const dir = path.join(root, "backups/validation/stage2-final"); await mkdir(dir, { recursive: true }); await page.screenshot({ path: path.join(dir, "failure.png"), fullPage: true }).catch(() => {}); }
  console.error(error instanceof Error ? error.message : "Falha no ensaio de navegador."); process.exitCode = 1;
}
finally {
  if (browser) await browser.close();
  for (const child of [frontend, backend]) if (child) { if (process.platform === "win32") { try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }); } catch {} } else child.kill("SIGTERM"); }
  if (database) await database.$disconnect();
  if (created) docker(["exec", "-T", "postgres", "dropdb", "-U", "postgres", "--force", databaseName]);
  if (frontend) await rm(path.join(root, "frontend/tsconfig.browser-test.json"), { force: true });
}

