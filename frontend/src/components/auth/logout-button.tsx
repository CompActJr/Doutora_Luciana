"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div>
    <button className="button-secondary" disabled={pending} onClick={async () => {
      setPending(true); setError("");
      try {
        await apiRequest("/auth/sign-out", { method: "POST", body: "{}" });
        window.location.assign("/login");
      } catch { setPending(false); setError("Não foi possível sair. Tente novamente."); }
    }}>{pending ? "Saindo…" : "Sair"}</button>
    {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
  </div>;
}
