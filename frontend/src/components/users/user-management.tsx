"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { UsersResponse } from "@dra/contracts";
import { apiRequest } from "@/lib/api";

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

  return <div className="grid gap-6">
    <div><h1 className="text-2xl font-semibold">Usuários e acessos</h1><p className="mt-2 text-muted">Cadastre a equipe e controle quem pode administrar o painel.</p></div>
    <section className="card" aria-labelledby="create-user"><h2 id="create-user" className="mb-4 text-lg font-semibold">Cadastrar usuário</h2>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={create}>
        <label className="grid gap-1 text-sm">Nome<input name="name" className="field" required minLength={2} maxLength={100} autoComplete="name" disabled={pending} /></label>
        <label className="grid gap-1 text-sm">E-mail<input name="email" className="field" type="email" required maxLength={254} autoComplete="email" disabled={pending} /></label>
        <label className="grid gap-1 text-sm">Senha inicial<input name="password" className="field" type="password" required minLength={12} maxLength={128} autoComplete="new-password" disabled={pending} />
          <span className="text-muted">De 12 a 128 caracteres.</span></label>
        <label className="grid gap-1 self-start text-sm">Perfil<select name="role" className="field" disabled={pending} defaultValue="editor">
          <option value="editor">Equipe — editar e simular</option><option value="admin">Administradora — gerenciar e publicar</option>
        </select></label>
        <button className="button justify-self-start" disabled={pending}>{pending ? "Aguarde…" : "Cadastrar"}</button>
      </form>
    </section>
    {message && <p role="status" className="card text-sm">{message}</p>}
    <section aria-labelledby="users-list"><h2 id="users-list" className="mb-4 text-lg font-semibold">Pessoas cadastradas</h2>
      {loading ? <p role="status">Carregando usuários…</p> : <ul className="grid gap-3">{users.map((user) => <li key={user.id} className="card flex flex-wrap items-center justify-between gap-4">
        <div><p className="font-semibold">{user.name}{user.id === currentUserId ? " (você)" : ""}</p><p className="break-all text-sm text-muted">{user.email}</p><p className="mt-1 text-sm">{user.disabled ? "Acesso bloqueado" : "Acesso ativo"}</p></div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="grid gap-1 text-sm">Perfil de {user.name}<select className="field" value={user.role} disabled={pending || user.id === currentUserId} onChange={(event) => void update(user.id, { role: event.target.value })}>
            <option value="editor">Equipe</option><option value="admin">Administradora</option>
          </select></label>
          <button className="button-secondary" disabled={pending || user.id === currentUserId} onClick={() => void update(user.id, { disabled: !user.disabled })}>{user.disabled ? "Liberar acesso" : "Bloquear acesso"}</button>
          <button className="button-secondary" disabled={pending} onClick={() => void update(user.id, {}, true)}>Encerrar sessões</button>
        </div>
      </li>)}</ul>}
    </section>
  </div>;
}
