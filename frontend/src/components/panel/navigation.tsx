"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";

const content = [
  { href: "/respostas", label: "Respostas", icon: "responses" },
  { href: "/conhecimento", label: "Conhecimento", icon: "knowledge" },
  { href: "/assistente", label: "Assistente", icon: "assistant" },
  { href: "/simulador", label: "Simulador", icon: "simulator" },
] as const;

const settings = [
  { href: "/configuracoes/versoes", label: "Versões e histórico", icon: "history" },
  { href: "/configuracoes/integracoes", label: "Integrações", icon: "plug" },
] as const;

export function PanelNavigation({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const item = ({ href, label, icon }: { href: string; label: string; icon: Parameters<typeof Icon>[0]["name"] }) =>
    <Link key={href} href={href} className="nav-item" aria-label={href === "/conhecimento" ? "Base de conhecimento" : undefined} aria-current={pathname === href ? "page" : undefined}><Icon name={icon} />{label}</Link>;
  return <nav aria-label="Navegação principal" className="panel-navigation">
    {content.map(item)}
    {admin && item({ href: "/agenda", label: "Agenda de consultas", icon: "calendar" })}
    <span className="nav-divider" aria-hidden="true" />
    <details className="nav-settings" open={pathname.startsWith("/configuracoes") || undefined} key={`settings:${pathname}`}>
      <summary className="nav-item"><Icon name="settings" />Configurações<Icon name="chevron" className="nav-chevron" /></summary>
      <div className="nav-subitems">{settings.map(item)}{admin && item({ href: "/configuracoes/usuarios", label: "Usuários e acessos", icon: "users" })}</div>
    </details>
  </nav>;
}

export function MobileNavigation() {
  const pathname = usePathname();
  const moreActive = !content.some(({ href }) => pathname === href);
  return <nav className="mobile-navigation" aria-label="Navegação do celular">
    {content.map(({ href, label, icon }) => <Link key={href} href={href} aria-label={label === "Conhecimento" ? "Base de conhecimento" : label} aria-current={pathname === href ? "page" : undefined}><Icon name={icon} /><span>{label === "Conhecimento" ? "Conhecim." : label}</span></Link>)}
    <Link href="/mais" aria-current={moreActive ? "page" : undefined}><Icon name="more" /><span>Mais</span></Link>
  </nav>;
}
