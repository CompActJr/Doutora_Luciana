"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api";
import { PasswordField } from "@/components/ui/password-field";

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

  return <main className="auth-shell">
    <section className="auth-card" aria-labelledby="auth-title">
      <img className="auth-logo" src="/images/logos/dra_luciana_logo_vt_cl.png" width="172" height="80" alt="Dra. Luciana Conceição — Odontologia" />
      <h1 id="auth-title">{title}</h1>
      {mode === "login" && <p className="auth-intro">Acesso restrito à equipe da clínica.</p>}
      {mode === "reset" && !token ? <p role="alert" className="auth-message">Link inválido ou expirado. Solicite uma nova recuperação de senha.</p> : !done &&
        <form onSubmit={submit}>
          {mode !== "reset" && <label>E-mail
            <input className="field" name="email" type="email" autoComplete="username" required maxLength={254} disabled={pending} />
          </label>}
          {mode !== "recover" && <label>{mode === "reset" ? "Nova senha" : "Senha"}
            <PasswordField className="field" name="password" autoComplete={mode === "reset" ? "new-password" : "current-password"}
              required minLength={mode === "reset" ? 12 : 1} maxLength={128} disabled={pending} />
          </label>}
          {mode === "reset" && <label>Confirme a nova senha
            <PasswordField className="field" name="confirmation" autoComplete="new-password" required minLength={12} maxLength={128} disabled={pending} />
            <span className="field-help">Use de 12 a 128 caracteres.</span>
          </label>}
          <button className="button" disabled={pending}>{pending ? "Aguarde…" : mode === "login" ? "Entrar" : mode === "recover" ? "Enviar instruções" : "Salvar nova senha"}</button>
        </form>}
      {message && <p className="auth-message" role={done ? "status" : "alert"}>{message}</p>}
      <div className="auth-link">
        <Link className="text-action" href={mode === "login" ? "/recuperar-senha" : done && mode === "reset" ? "/login" : mode === "reset" ? "/recuperar-senha" : "/login"}>
          {mode === "login" ? "Esqueci minha senha" : mode === "reset" && !done ? "Solicitar outro link" : "Voltar para o login"}
        </Link>
      </div>
    </section>
  </main>;
}
