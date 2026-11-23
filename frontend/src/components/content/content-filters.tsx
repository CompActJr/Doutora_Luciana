"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

type QuickFilter = { state: string; reviewStatus: string };
const chips = [
  { label: "Todas", state: "active", reviewStatus: "" },
  { label: "Em revisão", state: "active", reviewStatus: "needs_review" },
  { label: "Revisadas", state: "active", reviewStatus: "reviewed" },
  { label: "Desativadas", state: "inactive", reviewStatus: "" },
];

export function ContentFilters({ search, label, value, onSearch, onQuickFilter, children }: {
  search: string; label: string; value: QuickFilter; onSearch: (search: string) => void;
  onQuickFilter: (filter: QuickFilter) => void; children: ReactNode;
}) {
  return <div className="response-filters">
    <div className="filter-search-row"><label className="search-field"><span className="sr-only">{label}</span><Icon name="search" className="size-4" /><input value={search} maxLength={200} placeholder="Buscar" onChange={(event) => onSearch(event.target.value)} /></label>
      <details className="advanced-filters"><summary className="icon-button" aria-label="Mais filtros"><Icon name="filter" className="size-5" /></summary><div className="filter-popover" role="group" aria-label="Filtros avançados">{children}</div></details>
    </div>
    <div className="filter-chips" role="group" aria-label="Filtros rápidos">{chips.map(({ label, ...filter }) => <button key={label} type="button" aria-pressed={value.state === filter.state && value.reviewStatus === filter.reviewStatus} onClick={() => onQuickFilter(filter)}>{label}</button>)}</div>
  </div>;
}
