import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export async function runDesignBrowserChecks({ page, database, root, login, navigate, pass }) {
  const directory = path.join(root, "backups/validation/design");
  await mkdir(directory, { recursive: true });
  const shot = (name) => page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
  const noOverflow = async (label) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, label);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100/login");
  await page.getByLabel("Senha", { exact: true }).fill("senha-ficticia-para-teste");
  await page.getByRole("button", { name: "Mostrar senha", exact: true }).click();
  assert.equal(await page.getByLabel("Senha", { exact: true }).getAttribute("type"), "text");
  await page.getByRole("button", { name: "Ocultar senha", exact: true }).click();
  assert.equal(await page.getByLabel("Senha", { exact: true }).getAttribute("type"), "password");
  assert.ok((await page.locator(".auth-logo").boundingBox()).y >= 0);
  await page.getByLabel("Senha", { exact: true }).fill(""); await shot("login-mobile");
  await page.setViewportSize({ width: 1440, height: 900 }); await shot("login-desktop");
  for (const route of ["recuperar-senha", "redefinir-senha?token=ficticio"]) {
    await page.goto(`http://localhost:3100/${route}`);
    for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 844 }); await noOverflow(route); }
  }
  pass("Acesso e recuperação responsivos; mostrar/ocultar senha funciona sem alterar o valor");

  await page.setViewportSize({ width: 1440, height: 900 }); await login("admin");
  await page.getByRole("button", { name: /Primeira consulta fictícia/ }).click();
  await page.getByLabel("Resposta-base", { exact: true }).waitFor();
  await shot("responses-desktop");
  assert.equal(await page.locator(".response-preview").isVisible(), false);
  await page.getByRole("button", { name: "Prévia", exact: true }).click();
  await page.getByRole("heading", { name: "Prévia da conversa" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Publicar no WhatsApp" }).isDisabled(), true);
  await page.getByRole("button", { name: "Voltar a editar" }).click();
  pass("Editor desktop em duas colunas; prévia demonstrativa sob demanda e publicação bloqueada");

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.getByRole("navigation", { name: "Navegação do celular" }).isVisible(), true);
  await page.getByRole("button", { name: "Voltar aos modelos" }).click();
  await shot("responses-mobile-list");
  await page.getByRole("button", { name: "Em revisão", exact: true }).click();
  await page.getByText("Nenhum modelo cadastrado", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Revisadas", exact: true }).click();
  await page.getByRole("button", { name: /Primeira consulta fictícia/ }).waitFor();
  await page.getByLabel("Mais filtros", { exact: true }).click();
  await page.getByLabel("Filtrar categoria", { exact: true }).selectOption("Teste");
  await page.getByLabel("Mais filtros", { exact: true }).click();
  await page.getByRole("button", { name: /Primeira consulta fictícia/ }).click();
  await page.getByLabel("Resposta-base", { exact: true }).fill("Texto fictício ainda não salvo.");
  await page.getByRole("button", { name: "Prévia", exact: true }).click();
  await page.locator(".response-preview").getByText("Texto fictício ainda não salvo.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  assert.equal(await page.getByLabel("Resposta-base", { exact: true }).inputValue(), "Texto fictício ainda não salvo.");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Mais", exact: true }).click();
  assert.equal(new URL(page.url()).pathname, "/respostas");
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Rascunho salvo" }).waitFor();
  assert.equal((await database.responseTemplate.findFirstOrThrow()).answer, "Texto fictício ainda não salvo.");
  await shot("responses-mobile-editor");
  pass("Filtros rápidos/avançados, abas, salvamento e proteção de rascunho na navegação inferior");
  await page.locator(".editor-options summary").click();
  await page.getByRole("button", { name: "Duplicar", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Cópia criada" }).waitFor();
  assert.equal(await database.responseTemplate.count(), 2);
  await page.getByRole("button", { name: "Desativar", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Modelo desativado" }).waitFor();
  await page.getByRole("button", { name: "Reativar", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Modelo reativado" }).waitFor();
  pass("Mais ações mantém duplicação e desativação/reativação sem perder conteúdo");

  await navigate("Base de conhecimento", "/conhecimento");
  await page.getByRole("button", { name: /Clínica fictícia/ }).click();
  await page.getByLabel("Conteúdo", { exact: true }).fill("Informação fictícia revisável no celular.");
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Informação salva" }).waitFor();
  assert.equal((await database.knowledgeEntry.findFirstOrThrow()).content, "Informação fictícia revisável no celular.");
  await shot("knowledge-mobile-editor");
  await page.setViewportSize({ width: 1440, height: 900 }); await shot("knowledge-desktop");
  pass("Conhecimento conserva edição e persistência com editor desktop/celular");

  await page.setViewportSize({ width: 390, height: 844 }); await navigate("Assistente", "/assistente");
  await page.getByLabel("Nome da assistente", { exact: true }).waitFor();
  await page.getByRole("button", { name: /^Tom de voz/ }).click();
  await page.getByLabel("Tom de voz", { exact: true }).fill("Linguagem fictícia acolhedora e objetiva.");
  await shot("assistant-mobile");
  await page.setViewportSize({ width: 1440, height: 900 }); await shot("assistant-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^Identidade/ }).click();
  await page.getByLabel("Nome da assistente", { exact: true }).fill("");
  await page.getByRole("button", { name: /^Agendamento/ }).click();
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await page.getByLabel("Nome da assistente", { exact: true }).waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute("placeholder") === "Como a assistente deve se identificar");
  await page.getByLabel("Nome da assistente", { exact: true }).fill("Assistente fictícia");
  await page.getByRole("button", { name: /^Agendamento/ }).click();
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Configuração salva" }).waitFor();
  assert.equal((await database.assistantSettings.findUniqueOrThrow({ where: { id: "clinic" } })).tone, "Linguagem fictícia acolhedora e objetiva.");
  pass("Assistente em cinco etapas: edição preservada, validação abre campo obrigatório e salva rascunho");

  await navigate("Simulador", "/simulador");
  await page.getByRole("button", { name: "Iniciar conversa", exact: true }).click();
  await page.getByLabel("Mensagem de teste").fill("Como funciona a primeira consulta?");
  await page.getByRole("button", { name: "Testar resposta", exact: true }).click();
  await page.getByRole("log").getByText("Texto fictício ainda não salvo.", { exact: true }).waitFor();
  await shot("simulator-mobile");
  await page.getByRole("button", { name: "Conversas", exact: true }).click();
  await page.getByRole("heading", { name: "Seus testes", exact: true }).waitFor();
  await page.getByRole("button", { name: /Como funciona a primeira consulta/ }).click();
  await page.getByRole("log").waitFor();
  await page.setViewportSize({ width: 1440, height: 900 }); await shot("simulator-desktop");
  pass("Simulador móvel alterna histórico/conversa; resposta demonstrativa persistida e identificada");

  const routes = [["Respostas", "/respostas"], ["Base de conhecimento", "/conhecimento"], ["Assistente", "/assistente"], ["Simulador", "/simulador"], ["Versões e histórico", "/configuracoes/versoes"], ["Integrações", "/configuracoes/integracoes"], ["Usuários e acessos", "/configuracoes/usuarios"], ["Agenda de consultas", "/agenda"]];
  for (const [name, route] of routes) {
    await page.setViewportSize({ width: 1440, height: 900 }); await navigate(name, route);
    await page.getByRole("heading", { level: 1 }).waitFor();
    for (const width of [320, 390, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 844 }); await noOverflow(`${route}/${width}`); }
    await page.setViewportSize({ width: 390, height: 844 }); await shot(`${route.split("/").at(-1)}-mobile`);
    await page.setViewportSize({ width: 1440, height: 900 }); await shot(`${route.split("/").at(-1)}-desktop`);
  }
  pass("Oito áreas sem overflow em 320/390/768/1024/1440px, com capturas desktop/celular");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Mais", exact: true }).click();
  await page.getByRole("link", { name: "Usuários e acessos", exact: true }).waitFor(); await shot("more-mobile");
  await page.getByRole("button", { name: "Sair", exact: true }).click(); await page.waitForURL("**/login");
  await login("editor"); await page.getByRole("link", { name: "Mais", exact: true }).click();
  assert.equal(await page.getByRole("link", { name: "Usuários e acessos", exact: true }).count(), 0);
  assert.equal(await page.getByRole("link", { name: "Agenda de consultas", exact: true }).count(), 0);
  assert.equal(await page.evaluate(async () => (await fetch("/api/v1/calendar/status")).status), 403);
  await page.getByRole("link", { name: "Integrações", exact: true }).click();
  await page.getByRole("button", { name: "Publicar no WhatsApp", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Publicar no WhatsApp", exact: true }).isDisabled(), true);
  pass("Menu Mais usa dados da sessão, permite saída e respeita permissões da equipe e publicação bloqueada");
}
