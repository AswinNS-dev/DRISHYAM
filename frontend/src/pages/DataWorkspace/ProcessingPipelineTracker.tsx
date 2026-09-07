import { CheckCircle2, Clock, AlertTriangle, PlayCircle } from "lucide-react";
import type { PipelineStep } from "../../types/dataWorkspace";

interface Props {
  steps: PipelineStep[];
}

export default function ProcessingPipelineTracker({ steps }: Props) {
  function getStepIcon(status: PipelineStep["status"]) {
    switch (status) {
      case "completed":
      case "ready":
        return <CheckCircle2 size={13} className="text-emerald-400" />;
      case "processing":
        return <PlayCircle size={13} className="text-amber-400 animate-pulse" />;
      case "review_required":
        return <AlertTriangle size={13} className="text-amber-400" />;
      case "failed":
        return <AlertTriangle size={13} className="text-rose-400" />;
      case "pending":
      default:
        return <Clock size={13} className="text-zinc-600" />;
    }
  }

  function getStepBadge(status: PipelineStep["status"]) {
    switch (status) {
      case "completed":
        return "badge-verified";
      case "ready":
        return "badge-verified";
      case "processing":
        return "badge-demo";
      case "review_required":
        return "badge-high";
      case "failed":
        return "badge-high";
      case "pending":
      default:
        return "badge-low";
    }
  }

  function formatStatus(status: PipelineStep["status"]) {
    switch (status) {
      case "completed":
        return "Completed";
      case "ready":
        return "Ready";
      case "processing":
        return "In Progress";
      case "review_required":
        return "Review Req.";
      case "failed":
        return "Failed";
      case "pending":
      default:
        return "Pending";
    }
  }

  return (
    <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-3">
      <div className="flex items-center justify-between">
        <span className="hud-label text-[10px] tracking-wider text-[var(--text-muted)] font-mono">
          PROCESSING PIPELINE STATUS
        </span>
        <span className="text-[10px] font-mono text-zinc-400">Deterministic Ingestion Workflow</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-1">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const badgeClass = getStepBadge(step.status);
          const icon = getStepIcon(step.status);

          return (
            <div
              key={step.step}
              className={`relative p-3 rounded-lg border flex flex-col justify-between transition-all ${
                step.status === "completed" || step.status === "ready"
                  ? "bg-zinc-900/40 border-zinc-800"
                  : step.status === "review_required"
                  ? "bg-amber-950/20 border-amber-800/40"
                  : step.status === "processing"
                  ? "bg-zinc-900/80 border-zinc-700"
                  : "bg-zinc-950/40 border-zinc-900 opacity-70"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-bold text-zinc-400">
                    0{idx + 1}
                  </span>
                  <span className={`badge ${badgeClass} text-[8px]`}>
                    {formatStatus(step.status)}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-[var(--text-primary)] leading-snug">
                  {step.name}
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
                <div className="flex items-center gap-1">
                  {icon}
                  <span>{step.step.replace(/_/g, " ")}</span>
                </div>
                {step.count !== undefined && (
                  <span className="text-zinc-300 font-bold">{step.count} items</span>
                )}
              </div>

              {!isLast && (
                <div className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-zinc-700 pointer-events-none">
                  ›
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
