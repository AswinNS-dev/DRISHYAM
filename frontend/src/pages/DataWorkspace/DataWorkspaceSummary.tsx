import { Database, FileSpreadsheet, Activity, AlertCircle } from "lucide-react";
import type { DatasetSummary } from "../../types/dataWorkspace";

interface Props {
  summary: DatasetSummary | null;
  loading?: boolean;
}

export default function DataWorkspaceSummary({ summary, loading }: Props) {
  const cards = [
    {
      label: "TOTAL DATASETS",
      value: summary ? summary.total_datasets.toLocaleString() : "—",
      subtext: "Ingested intelligence files",
      icon: Database,
      badge: "ACTIVE INVENTORY",
      color: "text-zinc-100",
      badgeClass: "badge-low",
    },
    {
      label: "TOTAL RECORDS",
      value: summary ? summary.total_records.toLocaleString() : "—",
      subtext: "Evidence, narrative & registry entries",
      icon: FileSpreadsheet,
      badge: "VERIFIED ROWS",
      color: "text-zinc-100",
      badgeClass: "badge-verified",
    },
    {
      label: "PROCESSING",
      value: summary ? summary.processing.toString() : "—",
      subtext: "Pipelines currently active",
      icon: Activity,
      badge: summary?.processing ? "RUNNING" : "IDLE",
      color: summary?.processing ? "text-amber-400" : "text-zinc-300",
      badgeClass: summary?.processing ? "badge-demo" : "badge-low",
    },
    {
      label: "REQUIRES REVIEW",
      value: summary ? summary.requires_review.toString() : "—",
      subtext: "Unresolved candidate matches",
      icon: AlertCircle,
      badge: (summary?.requires_review ?? 0) > 0 ? "ACTION REQ" : "CLEAR",
      color: (summary?.requires_review ?? 0) > 0 ? "text-amber-400" : "text-zinc-400",
      badgeClass: (summary?.requires_review ?? 0) > 0 ? "badge-high" : "badge-verified",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="p-4 rounded-xl bg-slate-900/95 border border-slate-800/90 hover:border-slate-700 transition-colors shadow-xl flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                {card.label}
              </span>
              <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-sky-400 shadow-sm">
                <Icon size={15} />
              </div>
            </div>

            <div className="mt-3">
              {loading ? (
                <div className="h-7 w-20 bg-slate-800 rounded animate-pulse" />
              ) : (
                <div className={`text-2xl font-black font-mono tracking-tight text-white text-glow-white`}>
                  {card.value}
                </div>
              )}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400 truncate mr-2">
                  {card.subtext}
                </span>
                <span className={`badge ${card.badgeClass} text-[8px] shrink-0 font-mono`}>
                  {card.badge}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
