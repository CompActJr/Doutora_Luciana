"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { UsersResponse } from "@dra/contracts";
import { apiRequest } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { PasswordField } from "@/components/ui/password-field";

export function UserManagement({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UsersResponse["users"]>([]);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try { setUsers((await apiRequest<UsersResponse>("/users")).users); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível carregar os usuários."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function update(id: string, data: object, revoke = false) {
    setPending(true); setMessage("");
    try {
      await apiRequest(`/users/${encodeURIComponent(id)}${revoke ? "/revoke-sessions" : ""}`, {
        method: revoke ? "POST" : "PATCH", body: JSON.stringify(data),
      });
      if (revoke && id === currentUserId) { window.location.assign("/login"); return; }
      setMessage(revoke ? "Sessões encerradas." : "Acesso atualizado. As sessões anteriores foram encerradas.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível alterar o acesso."); }
    finally { setPending(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setPending(true); setMessage("");
    try {
      await apiRequest("/users", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
      element.reset(); setMessage("Usuário cadastrado. Compartilhe a senha inicial por um canal seguro.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar."); }
    finally { setPending(false); }
  }

  return <div className="users-page">
    <div className="page-heading"><div><h1>Usuários e acessos</h1></div><a className="button create-content" href="#create-user" aria-label="Novo acesso"><Icon name="plus" className="size-4" /><span>Novo acesso</span></a></div>
    {message && <p role="status" className="feedback mb-0">{message}</p>}
    <div className="users-workspace"><section className="content-card" aria-labelledby="users-list"><h2 id="users-list" className="sr-only">Pessoas cadastradas</h2>
      {loading ? <p role="status" className="field-help">Carregando usuários…</p> : <ul className="user-list">{users.map((user) => <li key={user.id} className="card user-row">
        <div className="user-identity"><span className="avatar" aria-hidden="true">{user.name.trim().slice(0, 1).toUpperCase()}</span><div><p className="font-semibold">{user.name}{user.id === currentUserId ? " (você)" : ""}</p><p className="break-all text-sm text-muted">{user.email}</p><p className={`user-status ${user.disabled ? "blocked" : ""}`}>{user.disabled ? "Acesso bloqueado" : "Acesso ativo"}</p></div></div>
        <span className="badge user-role">{user.role === "admin" ? "Administradora" : "Equipe"}</span>
        <details className="user-actions-menu"><summary className="icon-button" aria-label={`Ações de ${user.name}`}><Icon name="more" className="size-5" /></summary><div className="user-actions">
          <label className="grid gap-1 text-sm">Perfil de {user.name}<select className="field" value={user.role} disabled={pending || user.id === currentUserId} onChange={(event) => void update(user.id, { role: event.target.value })}>
            <option value="editor">Equipe</option><option value="admin">Administradora</option>
          </select></label>
          <button className="button-secondary" disabled={pending || user.id === currentUserId} onClick={() => void update(user.id, { disabled: !user.disabled })}>{user.disabled ? "Liberar acesso" : "Bloquear acesso"}</button>
          <button className="button-secondary" disabled={pending} onClick={() => void update(user.id, {}, true)}>Encerrar sessões</button>
        </div></details>
      </li>)}</ul>}
    </section>
    <section className="card" aria-labelledby="create-user"><h2 id="create-user" className="mb-4 text-lg font-semibold">Novo acesso</h2>
      <form className="form-grid" onSubmit={create}>
        <label>Nome<input name="name" className="field" required minLength={2} maxLength={100} autoComplete="name" disabled={pending} /></label>
        <label>E-mail<input name="email" className="field" type="email" required maxLength={254} autoComplete="email" disabled={pending} /></label>
        <label>Senha inicial<PasswordField name="password" className="field" required minLength={12} maxLength={128} autoComplete="new-password" disabled={pending} />
          <span className="field-help">De 12 a 128 caracteres.</span></label>
        <label className="self-start">Perfil<select name="role" className="field" disabled={pending} defaultValue="editor">
          <option value="editor">Equipe — editar e simular</option><option value="admin">Administradora — gerenciar e publicar</option>
        </select></label>
        <button className="button justify-self-start" disabled={pending}>{pending ? "Aguarde…" : "Cadastrar"}</button>
      </form>
    </section></div>
  </div>;
}
