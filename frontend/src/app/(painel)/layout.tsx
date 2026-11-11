import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return <div className="mx-auto max-w-5xl px-5 py-8">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-brand/15 pb-5">
      <div><p className="font-semibold">Dra. Luciana</p><p className="text-sm text-muted">{user.name} · {user.role === "admin" ? "Administradora" : "Equipe"}</p></div>
      <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-5 text-sm">
        <Link href="/respostas" className="underline underline-offset-4">Respostas</Link>
        {user.role === "admin" && <Link href="/configuracoes/usuarios" className="underline underline-offset-4">Usuários</Link>}
        <LogoutButton />
      </nav>
    </header>
    <main>{children}</main>
  </div>;
}
