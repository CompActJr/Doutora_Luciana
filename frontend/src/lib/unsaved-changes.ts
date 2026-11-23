"use client";

import { useEffect } from "react";

export function confirmDiscard(dirty: boolean) {
  return !dirty || window.confirm("Há alterações não salvas. Deseja descartá-las?");
}

export function useUnsavedChanges(dirty: boolean, discard: () => void) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const exit = event.target.closest("button[data-panel-exit]");
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!exit && (!link || link.target === "_blank" || link.hasAttribute("download"))) return;
      if (link && !exit) {
        const target = new URL(link.href, window.location.href);
        if (target.pathname === window.location.pathname && target.search === window.location.search) return;
      }
      if (!window.confirm("Há alterações não salvas. Deseja descartá-las e sair?")) {
        event.preventDefault(); event.stopPropagation();
      } else discard();
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty, discard]);
}
