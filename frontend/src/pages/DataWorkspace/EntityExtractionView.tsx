import { useState } from "react";
import { Scan, Filter, Layers } from "lucide-react";
import type { ExtractedEntity } from "../../types/dataWorkspace";

interface Props {
  entities: ExtractedEntity[];
  entityGroups?: Record<string, number>;
}

const TYPE_STYLES: Record<string, { badge: string; label: string }> = {
  PERSON: { badge: "badge-info", label: "PERSON" },
  ALIAS: { badge: "badge-low", label: "ALIAS" },
  PHONE: { badge: "badge-low", label: "PHONE" },
  VEHICLE: { badge: "badge-medium", label: "VEHICLE" },
  LOCATION: { badge: "badge-purple", label: "LOCATION" },
  ORGANIZATION: { badge: "badge-high", label: "ORG / SYNDICATE" },
  GANG: { badge: "badge-high", label: "GANG" },
  BANK_ACCOUNT: { badge: "badge-medium", label: "FINANCIAL ACCT" },
  FIR_NUMBER: { badge: "badge-demo", label: "FIR REF" },
  CASE_NUMBER: { badge: "badge-demo", label: "CASE REF" },
  DATE: { badge: "badge-low", label: "DATETIME" },
  CRIME_TYPE: { badge: "badge-high", label: "CRIME TYPE" },
};

export default function EntityExtractionView({ entities, entityGroups }: Props) {
  const [filterType, setFilterType] = useState<string>("ALL");

  const types = ["ALL", ...Array.from(new Set(entities.map((e) => e.type)))];

  const filtered = filterType === "ALL"
    ? entities
    : entities.filter((e) => e.type === filterType);

  return (
    <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <Scan size={15} className="text-zinc-300" />
          <span className="hud-label text-[11px] text-[var(--text-primary)] font-mono">
            EXTRACTED ENTITIES FROM DATASET ({entities.length})
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Filter size={12} className="text-zinc-500 shrink-0" />
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap transition-colors ${
                filterType === t
                  ? "bg-zinc-100 text-zinc-900 font-bold"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
              }`}
            >
              {t} {t !== "ALL" && entityGroups?.[t] ? `(${entityGroups[t]})` : ""}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 text-center space-y-1 text-zinc-500 font-mono text-xs">
          <Layers size={18} className="mx-auto text-zinc-600 mb-1" />
          No entities found for the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-1">
          {filtered.map((item, idx) => {
            const style = TYPE_STYLES[item.type] || { badge: "badge-low", label: item.type };
            const confPercent = Math.round((item.confidence || 0.85) * 100);

            return (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-zinc-700 transition-colors flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)] font-mono truncate">
                    {item.text}
                  </span>
                  <span className={`badge ${style.badge} text-[8px] shrink-0`}>
                    {style.label}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] mt-2 pt-1.5 border-t border-[var(--border-subtle)]">
                  <span>Confidence: {confPercent}%</span>
                  <span className="text-zinc-500 truncate max-w-[120px]" title={item.rule || item.model}>
                    {item.rule || item.model || "NER v2"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
