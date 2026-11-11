import { emitKeypressEvents } from "node:readline";
import { createInterface as createPrompt } from "node:readline/promises";
import { createDatabase } from "../../plugins/database.js";
import { createUser, createUserSchema } from "./service.js";

async function passwordPrompt(label: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error("Execute em um terminal interativo.");
  process.stdout.write(label);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const onKey = (text: string | undefined, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") { finish(); reject(new Error("Operação cancelada.")); }
      else if (key.name === "return" || key.name === "enter") { finish(); resolve(value); }
      else if (key.name === "backspace") value = value.slice(0, -1);
      else if (text && !key.ctrl && !text.startsWith("\u001b")) value += text;
    };
    function finish() {
      process.stdin.removeListener("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    }
    process.stdin.on("keypress", onKey);
  });
}

const databaseURL = process.env.DATABASE_URL;
if (!databaseURL) throw new Error("Configure DATABASE_URL antes de continuar.");
const database = createDatabase(databaseURL);
try {
  if (await database.user.count() !== 0) throw new Error("Já existem usuários. Use a administração do painel.");
  if (!process.stdin.isTTY) throw new Error("Execute em um terminal interativo.");
  const prompt = createPrompt({ input: process.stdin, output: process.stdout });
  const name = await prompt.question("Nome da administradora: ");
  const email = await prompt.question("E-mail: ");
  prompt.close();
  const password = await passwordPrompt("Senha (12 a 128 caracteres; entrada oculta): ");
  const confirmation = await passwordPrompt("Confirme a senha: ");
  if (password !== confirmation) throw new Error("As senhas não conferem.");
  const parsed = createUserSchema.safeParse({ name, email, password, role: "admin" });
  if (!parsed.success) throw new Error("Informe nome, e-mail e senha de 12 a 128 caracteres válidos.");
  await createUser(database, parsed.data, true);
  console.log("Primeira administradora criada. Acesse a tela de login.");
} catch (error) {
  // Nunca imprimir erros do driver, que podem carregar a conexão ou os dados recebidos.
  console.error(error instanceof Error && !('code' in error) && error.name === "Error" ? error.message : "Não foi possível criar a administradora.");
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
