import assert from "node:assert/strict";
import path from "node:path";
import { mkdir } from "node:fs/promises";

export async function runCalendarBrowserChecks({ page, context, database, root, login, pass }) {
  let oauthRedirects = 0;
  // A autorização Google é interceptada. Nenhuma página ou API externa é acessada.
  await context.route(/.*/, async (route) => {
    const url = new URL(route.request().url());
    if (["localhost", "127.0.0.1"].includes(url.hostname)) return route.continue();
    if (url.origin === "https://accounts.google.com" && url.pathname === "/o/oauth2/v2/auth") {
      assert.equal(url.searchParams.get("client_id"), "fixture-client");
      assert.ok(url.searchParams.get("code_challenge")); oauthRedirects++;
      return route.fulfill({ status: 302, headers: { location: `http://localhost:3100/api/v1/calendar/oauth/callback?${new URLSearchParams({ state: url.searchParams.get("state"), code: "fixture-code" })}` }, body: "" });
    }
    await route.abort(); throw new Error("Requisição externa inesperada no ensaio.");
  });
  await login("admin");
  await page.getByRole("link", { name: "Agenda de consultas", exact: true }).click(); await page.waitForURL("**/agenda");
  await page.getByRole("button", { name: "Conectar Google Agenda", exact: true }).click();
  await page.getByText("calendar-admin@example.invalid", { exact: true }).waitFor(); assert.equal(oauthRedirects, 1);
  assert.ok(!(await page.locator("body").innerText()).includes("fixture-refresh-token"));
  pass("Conectar Google pelo botão e retorno OAuth com autorização interceptada; sem expor tokens");
  await page.getByRole("button", { name: "Escolher agenda", exact: true }).click(); await page.getByLabel("Agenda de consultas", { exact: true }).selectOption("clinic-fixture@example.invalid"); await page.getByRole("button", { name: "Usar esta agenda", exact: true }).click();
  await page.getByRole("heading", { name: "Agenda fictícia de consultas", exact: true }).waitFor();
  await page.getByLabel("Data da agenda", { exact: true }).fill("2030-03-04"); await page.getByLabel("Visualização da agenda").selectOption("day");
  await page.getByRole("button", { name: /Consulta inicial fictícia/ }).waitFor(); await page.getByText("Fuso: America/Sao_Paulo", { exact: false }).waitFor();
  assert.ok((await page.getByRole("button", { name: /Consulta inicial fictícia/ }).innerText()).includes("09:00"));
  pass("Seleção da agenda e exibição dos horários no fuso correto");
  await page.getByRole("button", { name: "Nova consulta", exact: true }).click();
  await page.getByLabel("Título da consulta", { exact: true }).fill("Consulta criada pelo painel fictício"); await page.getByLabel("Início", { exact: true }).fill("2030-03-04T11:00"); await page.getByLabel("Término", { exact: true }).fill("2030-03-04T12:00"); await page.getByLabel("Observações administrativas").fill("Somente um registro de teste.");
  page.once("dialog", (dialog) => dialog.dismiss()); await page.getByRole("link", { name: "Respostas", exact: true }).click(); assert.equal(new URL(page.url()).pathname, "/agenda");
  await page.getByRole("button", { name: "Salvar no Google Agenda", exact: true }).click(); await page.getByRole("status").filter({ hasText: "Consulta criada" }).waitFor(); await page.getByRole("button", { name: /Consulta criada pelo painel fictício/ }).waitFor();
  pass("Criar consulta, salvar no provedor fictício e proteger alterações não salvas");
  await page.getByRole("button", { name: "Nova consulta", exact: true }).click(); await page.getByLabel("Título da consulta", { exact: true }).fill("Consulta em conflito fictícia"); await page.getByLabel("Início", { exact: true }).fill("2030-03-04T09:30"); await page.getByLabel("Término", { exact: true }).fill("2030-03-04T10:30");
  await page.getByRole("button", { name: "Salvar no Google Agenda", exact: true }).click(); await page.locator("#panel-content [role=alert]").filter({ hasText: "Já existe um compromisso" }).waitFor(); assert.equal(await page.getByLabel("Título da consulta", { exact: true }).inputValue(), "Consulta em conflito fictícia");
  await page.getByLabel("Início", { exact: true }).fill("2030-03-04T13:00"); await page.getByLabel("Término", { exact: true }).fill("2030-03-04T14:00"); await page.getByRole("button", { name: "Salvar no Google Agenda", exact: true }).click(); await page.getByRole("status").filter({ hasText: "Consulta criada" }).waitFor();
  pass("Sobreposição rejeitada sem perder formulário; novo horário pode ser salvo");
  await page.getByRole("button", { name: /Consulta criada pelo painel fictício/ }).click(); await page.getByLabel("Início", { exact: true }).fill("2030-03-04T12:00"); await page.getByLabel("Término", { exact: true }).fill("2030-03-04T13:00"); await page.getByRole("button", { name: "Salvar no Google Agenda", exact: true }).click(); await page.getByRole("status").filter({ hasText: "Consulta atualizada" }).waitFor();
  assert.ok((await page.getByRole("button", { name: /Consulta criada pelo painel fictício/ }).innerText()).includes("12:00")); pass("Reagendamento altera o evento existente e atualiza a visualização");
  await page.getByRole("button", { name: /Consulta criada pelo painel fictício/ }).click();
  const other = await context.newPage(); await other.goto("http://localhost:3100/agenda"); await other.getByLabel("Data da agenda", { exact: true }).fill("2030-03-04"); await other.getByLabel("Visualização da agenda").selectOption("day"); await other.getByRole("button", { name: /Consulta criada pelo painel fictício/ }).click();
  await other.getByLabel("Título da consulta", { exact: true }).fill("Consulta alterada em outra aba"); await other.getByRole("button", { name: "Salvar no Google Agenda", exact: true }).click(); await other.getByRole("status").filter({ hasText: "Consulta atualizada" }).waitFor(); await other.close();
  await page.getByLabel("Título da consulta", { exact: true }).fill("Edição local preservada"); await page.getByRole("button", { name: "Salvar no Google Agenda", exact: true }).click(); await page.locator("#panel-content [role=alert]").filter({ hasText: "O evento mudou" }).waitFor(); assert.equal(await page.getByLabel("Título da consulta", { exact: true }).inputValue(), "Edição local preservada");
  await page.getByRole("button", { name: "Atualizar agenda", exact: true }).click(); await page.getByRole("button", { name: /Consulta alterada em outra aba/ }).waitFor();
  page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: /Consulta alterada em outra aba/ }).click(); await page.getByLabel("Título da consulta", { exact: true }).waitFor(); assert.equal(await page.getByLabel("Título da consulta", { exact: true }).inputValue(), "Consulta alterada em outra aba");
  pass("Alteração concorrente por etag preserva edição e exige reabrir evento atual");
  page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Cancelar consulta", exact: true }).click(); await page.getByRole("status").filter({ hasText: "Consulta cancelada" }).waitFor(); await page.getByRole("button", { name: /Consulta alterada em outra aba/ }).waitFor({ state: "hidden" });
  pass("Cancelamento com confirmação remove somente a consulta selecionada");
  await page.getByRole("button", { name: /Consulta inicial fictícia/ }).click(); await page.getByText("As alterações afetam somente esta ocorrência.", { exact: true }).waitFor(); await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByLabel("Visualização da agenda").selectOption("week"); await page.getByRole("button", { name: /Bloqueio de dia inteiro fictício/ }).click(); await page.getByRole("heading", { name: "Detalhes do evento", exact: true }).waitFor(); assert.equal(await page.getByRole("button", { name: "Salvar no Google Agenda" }).count(), 0); await page.getByRole("button", { name: "Fechar", exact: true }).click();
  pass("Ocorrências recorrentes identificadas; eventos de dia inteiro são somente visualização");
  const dir = path.join(root, "backups/validation/calendar"); await mkdir(dir, { recursive: true }); await page.screenshot({ path: path.join(dir, "agenda-desktop.png"), fullPage: true });
  for (const view of ["day", "week", "month"]) { await page.getByLabel("Visualização da agenda").selectOption(view); for (const width of [320, 390, 768, 1024, 1536]) { await page.setViewportSize({ width, height: 1000 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${view}/${width}`); } }
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(dir, "agenda-mobile.png"), fullPage: true });
  pass("Dia, semana e mês responsivos em 320/390/768/1024/1536px");
  await page.setViewportSize({ width: 1536, height: 1050 }); await page.getByLabel("Visualização da agenda").selectOption("day"); await page.getByRole("button", { name: "Nova consulta", exact: true }).click(); await page.getByLabel("Título da consulta", { exact: true }).focus(); await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => document.activeElement.id), "appointment-start"); await page.getByRole("button", { name: "Fechar", exact: true }).click(); pass("Rótulos e navegação por teclado no formulário");
  await page.reload(); await page.getByLabel("Data da agenda", { exact: true }).waitFor(); assert.equal(await database.calendarConnection.count(), 1); pass("Conexão persiste ao recarregar o painel");
  await page.getByLabel("Data da agenda", { exact: true }).fill("2030-03-11"); await page.getByLabel("Visualização da agenda").selectOption("day");
  await page.getByRole("button", { name: /Horário cedo fictício/ }).waitFor(); await page.getByRole("button", { name: /Horário tarde fictício/ }).waitFor();
  const early = await page.getByRole("button", { name: /Horário cedo fictício/ }).boundingBox();
  const late = await page.getByRole("button", { name: /Horário tarde fictício/ }).boundingBox();
  assert.ok(late.y > early.y + 1200);
  const laneA = await page.getByRole("button", { name: /Sobreposição visual A/ }).boundingBox();
  const laneB = await page.getByRole("button", { name: /Sobreposição visual B/ }).boundingBox();
  assert.ok(laneA.x + laneA.width <= laneB.x + 1);
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByLabel("Visualização da agenda").selectOption("week");
  await page.getByRole("button", { name: /Horário cedo fictício/ }).waitFor();
  await page.locator(".calendar-day-strip button").nth(1).click(); await page.locator('.calendar-time-column[data-selected="true"]').getByText("Sem compromissos neste dia.", { exact: true }).waitFor();
  await page.getByLabel("Data da agenda", { exact: true }).fill("2030-03-11");
  await page.getByLabel("Data da agenda", { exact: true }).fill("2030-03-12"); await page.locator('.calendar-time-column[data-selected="true"]').getByText("Sem compromissos neste dia.", { exact: true }).waitFor();
  await page.getByLabel("Data da agenda", { exact: true }).fill("2030-03-11"); await page.getByRole("button", { name: /Horário tarde fictício/ }).waitFor();
  await page.screenshot({ path: path.join(dir, "agenda-timeline-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.getByLabel("Data da agenda", { exact: true }).fill("2030-03-04"); await page.getByRole("button", { name: /Consulta inicial fictícia/ }).waitFor(); await page.screenshot({ path: path.join(dir, "agenda-timeline-desktop.png"), fullPage: true });
  pass("Grade cobre horários fora de 08h–18h, separa sobreposições e respeita seleção de dia/data no celular");
  await page.getByRole("button", { name: "Conexão Google", exact: true }).click(); page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Desconectar", exact: true }).click(); await page.getByRole("status").filter({ hasText: "Conta desconectada" }).waitFor(); assert.equal(await database.calendarConnection.count(), 0); await page.getByRole("button", { name: "Conectar Google Agenda", exact: true }).waitFor(); pass("Desconectar remove credencial local e retorna ao estado sem conexão");
  await page.getByRole("button", { name: "Sair", exact: true }).click(); await page.waitForURL("**/login"); await login("editor"); assert.equal(await page.getByRole("link", { name: "Agenda de consultas", exact: true }).count(), 0); await page.goto("http://localhost:3100/agenda"); await page.waitForURL("**/respostas"); assert.equal(await page.evaluate(async () => (await fetch("/api/v1/calendar/status")).status), 403); pass("Equipe sem acesso à agenda ou aos dados de consultas na API");
}
