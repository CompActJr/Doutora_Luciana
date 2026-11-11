"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api";

type Mode = "login" | "recover" | "reset";

export function AuthForm({ mode, token }: { mode: Mode; token?: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const title = mode === "login" ? "Entrar no painel" : mode === "recover" ? "Recuperar acesso" : "Criar nova senha";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setMessage("");
    try {
      if (mode === "login") {
        await apiRequest("/auth/sign-in/email", { method: "POST", body: JSON.stringify({
          email: String(form.get("email")).trim(), password: form.get("password"), rememberMe: false,
        }) });
        window.location.assign("/respostas");
      } else if (mode === "recover") {
        await apiRequest("/auth/request-password-reset", { method: "POST", body: JSON.stringify({
          email: String(form.get("email")).trim(), redirectTo: `${window.location.origin}/redefinir-senha`,
        }) });
        setDone(true); setMessage("Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.");
      } else {
        if (form.get("password") !== form.get("confirmation")) throw new Error("As senhas não conferem.");
        await apiRequest("/auth/reset-password", { method: "POST", body: JSON.stringify({ newPassword: form.get("password"), token }) });
        setDone(true); setMessage("Senha redefinida. Entre com sua nova senha.");
      }
    } catch (error) {
      setMessage(mode === "login" && error instanceof Error && /sessão|permissão|dados/.test(error.message)
        ? "E-mail ou senha inválidos, ou acesso indisponível."
        : error instanceof Error ? error.message : "Não foi possível conectar. Tente novamente.");
    } finally { setPending(false); }
  }

  return <main className="flex min-h-screen items-center justify-center px-5 py-12">
    <section className="card w-full max-w-md" aria-labelledby="auth-title">
      <p className="mb-2 text-sm font-medium text-muted">Dra. Luciana · Painel da clínica</p>
      <h1 id="auth-title" className="mb-5 text-2xl font-semibold">{title}</h1>
      {mode === "login" && <p className="mb-5 text-sm text-muted">Acesso exclusivo para pessoas autorizadas pela clínica.</p>}
      {mode === "reset" && !token ? <p role="alert">Link inválido ou expirado. Solicite uma nova recuperação de senha.</p> : !done &&
        <form onSubmit={submit} className="grid gap-4">
          {mode !== "reset" && <label className="grid gap-1 text-sm">E-mail
            <input className="field" name="email" type="email" autoComplete="username" required maxLength={254} disabled={pending} />
          </label>}
          {mode !== "recover" && <label className="grid gap-1 text-sm">{mode === "reset" ? "Nova senha" : "Senha"}
            <input className="field" name="password" type="password" autoComplete={mode === "reset" ? "new-password" : "current-password"}
              required minLength={mode === "reset" ? 12 : 1} maxLength={128} disabled={pending} />
          </label>}
          {mode === "reset" && <label className="grid gap-1 text-sm">Confirme a nova senha
            <input className="field" name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={pending} />
            <span className="text-muted">Use de 12 a 128 caracteres.</span>
          </label>}
          <button className="button" disabled={pending}>{pending ? "Aguarde…" : mode === "login" ? "Entrar" : mode === "recover" ? "Enviar instruções" : "Salvar nova senha"}</button>
        </form>}
      {message && <p className="mt-4 text-sm" role={done ? "status" : "alert"}>{message}</p>}
      <div className="mt-5 text-sm underline underline-offset-4">
        <Link href={mode === "login" ? "/recuperar-senha" : done && mode === "reset" ? "/login" : mode === "reset" ? "/recuperar-senha" : "/login"}>
          {mode === "login" ? "Esqueci minha senha" : mode === "reset" && !done ? "Solicitar outro link" : "Voltar para o login"}
        </Link>
      </div>
    </section>
  </main>;
}
