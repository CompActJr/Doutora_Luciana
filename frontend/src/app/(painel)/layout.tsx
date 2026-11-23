import type { ReactNode } from "react";
import { requireUser } from "@/lib/session";
import { LogoutButton } from "@/components/auth/logout-button";
import { MobileNavigation, PanelNavigation } from "@/components/panel/navigation";

const initials = (name: string) => name.trim().split(/\s+/).filter((part) => !/^dra?\.?$/i.test(part)).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return <div className="panel-shell">
    <a href="#panel-content" className="skip-link">Ir para o conteúdo</a>
    <aside className="panel-sidebar">
      <div className="panel-brand"><img src="/images/logos/dra_luciana_logo_vt_cl.png" width="136" height="63" alt="Dra. Luciana Conceição — Odontologia" /></div>
      <PanelNavigation admin={user.role === "admin"} />
      <div className="panel-account-area"><p className="connection-status">WhatsApp desconectado</p><div className="panel-account">
        <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
        <div><p>{user.name}</p><span>{user.role === "admin" ? "Administradora" : "Equipe"}</span></div>
        <LogoutButton />
      </div></div>
    </aside>
    <main id="panel-content" className="panel-content">{children}</main>
    <MobileNavigation />
  </div>;
}
