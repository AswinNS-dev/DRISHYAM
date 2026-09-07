import { CheckCircle, AlertTriangle, XCircle, FileWarning, ShieldCheck } from "lucide-react";
import type { ValidationReport } from "../../types/dataWorkspace";

interface Props {
  validation: ValidationReport;
}

export default function DataValidationCard({ validation }: Props) {
  const isHealthy = validation.invalid_records === 0 && validation.missing_fields === 0;

  return (
    <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className={isHealthy ? "text-emerald-400" : "text-amber-400"} />
          <span className="hud-label text-[11px] text-[var(--text-primary)] font-mono">
            DATASET INTEGRITY & VALIDATION REPORT
          </span>
        </div>
        <span
          className={`badge ${
            validation.status === "VALIDATED"
              ? "badge-verified"
              : validation.status === "WARNINGS"
              ? "badge-demo"
              : "badge-high"
          } text-[9px]`}
        >
          {validation.status}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
          <span className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">
            TOTAL ROWS
          </span>
          <span className="text-lg font-bold font-mono text-zinc-100">
            {validation.total_records.toLocaleString()}
          </span>
          <span className="text-[10px] text-zinc-500 block mt-0.5">Ingested scope</span>
        </div>

        <div className="p-3 rounded-lg bg-[var(--bg-panel-raised)] border border-emerald-950/40">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-[var(--text-muted)]">VALID</span>
            <CheckCircle size={12} className="text-emerald-400" />
          </div>
          <span className="text-lg font-bold font-mono text-emerald-400">
            {validation.valid_records.toLocaleString()}
          </span>
          <span className="text-[10px] text-emerald-500/80 block mt-0.5">Schema compliant</span>
        </div>

        <div className="p-3 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-[var(--text-muted)]">DUPLICATES</span>
            <AlertTriangle size={12} className={validation.duplicate_records > 0 ? "text-amber-400" : "text-zinc-600"} />
          </div>
          <span className={`text-lg font-bold font-mono ${validation.duplicate_records > 0 ? "text-amber-400" : "text-zinc-400"}`}>
            {validation.duplicate_records.toLocaleString()}
          </span>
          <span className="text-[10px] text-zinc-500 block mt-0.5">Existing identifiers</span>
        </div>

        <div className="p-3 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-[var(--text-muted)]">INVALID</span>
            <XCircle size={12} className={validation.invalid_records > 0 ? "text-rose-400" : "text-zinc-600"} />
          </div>
          <span className={`text-lg font-bold font-mono ${validation.invalid_records > 0 ? "text-rose-400" : "text-zinc-400"}`}>
            {validation.invalid_records.toLocaleString()}
          </span>
          <span className="text-[10px] text-zinc-500 block mt-0.5">Malformed syntax</span>
        </div>

        <div className="p-3 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-[var(--text-muted)]">MISSING FIELDS</span>
            <FileWarning size={12} className={validation.missing_fields > 0 ? "text-amber-400" : "text-zinc-600"} />
          </div>
          <span className={`text-lg font-bold font-mono ${validation.missing_fields > 0 ? "text-amber-400" : "text-zinc-400"}`}>
            {validation.missing_fields.toLocaleString()}
          </span>
          <span className="text-[10px] text-zinc-500 block mt-0.5">Required omissions</span>
        </div>
      </div>

      <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-[var(--border-subtle)] flex items-center justify-between text-[11px] font-mono text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>
            {isHealthy
              ? "All ingested rows successfully passed integrity verification rules."
              : "Records contain warnings or format discrepancies. Review required before correlation."}
          </span>
        </div>
        <span className="text-zinc-500 text-[10px]">Deterministic Check</span>
      </div>
    </div>
  );
}
