import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Icon } from "@/components/ui/icon";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function MorePage() {
  const user = await requireUser();
  const initials = user.name.trim().split(/\s+/).filter((part) => !/^dra?\.?$/i.test(part)).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
  const links = [
    { href: "/configuracoes/versoes", label: "Versões e histórico", icon: "history" },
    { href: "/configuracoes/integracoes", label: "Integrações", icon: "plug" },
    ...(user.role === "admin" ? [{ href: "/configuracoes/usuarios", label: "Usuários e acessos", icon: "users" as const }] : []),
  ] as const;
  return <div className="more-page">
    <div className="page-heading"><div><h1>Mais</h1></div></div>
    <section className="content-card more-account"><span className="avatar">{initials}</span><div><strong>{user.name}</strong><p className="field-help">{user.role === "admin" ? "Administradora" : "Equipe"}</p></div></section>
    {user.role === "admin" && <Link className="content-card more-link" href="/agenda"><Icon name="calendar" />Agenda de consultas<Icon name="chevron" /></Link>}
    <h2 className="more-heading">Configurações</h2>
    <nav className="content-card more-links" aria-label="Configurações">{links.map(({ href, label, icon }) => <Link key={href} href={href}><Icon name={icon} />{label}<Icon name="chevron" /></Link>)}</nav>
    <p className="connection-status">WhatsApp desconectado</p>
    <div className="more-logout"><LogoutButton showLabel /></div>
  </div>;
}
