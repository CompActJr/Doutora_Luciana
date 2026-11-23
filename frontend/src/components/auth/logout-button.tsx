"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { Icon } from "@/components/ui/icon";

export function LogoutButton({ showLabel = false }: { showLabel?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <>
    <button className="icon-button" data-panel-exit disabled={pending} aria-label={pending ? "Saindo…" : "Sair"} title="Sair" onClick={async () => {
      setPending(true); setError("");
      try {
        await apiRequest("/auth/sign-out", { method: "POST", body: "{}" });
        window.location.assign("/login");
      } catch { setPending(false); setError("Não foi possível sair. Tente novamente."); }
    }}><Icon name="logout" className="size-[18px]" />{showLabel && <span>Sair</span>}</button>
    {error && <p role="alert" className="account-error">{error}</p>}
  </>;
}
