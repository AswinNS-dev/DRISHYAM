import { ShieldAlert, CheckCheck, UserCheck, AlertTriangle } from "lucide-react";
import type { EntityMatchCandidate } from "../../types/dataWorkspace";

interface Props {
  matches: EntityMatchCandidate[];
}

export default function EntityResolutionPanel({ matches }: Props) {
  return (
    <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-4">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <UserCheck size={16} className="text-zinc-300" />
          <span className="hud-label text-[11px] text-[var(--text-primary)] font-mono">
            POTENTIAL IDENTITY MATCHES & RESOLUTION CANDIDATES ({matches.length})
          </span>
        </div>
        <span className="text-[10px] font-mono text-zinc-400">Investigator Oversight Protocol</span>
      </div>

      {/* Mandatory Investigator Review Notice */}
      <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-xs flex items-start gap-2.5 text-amber-200/90 leading-relaxed">
        <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 font-mono text-[11px]">
          <span className="font-bold uppercase text-amber-300 tracking-wider block">
            Advisory Notice: Human-in-the-Loop Requirement
          </span>
          <p className="text-amber-200/80">
            Potential matches are heuristic similarity signals and do NOT represent an automatic merge or confirmed legal identity.
            All candidate associations require formal investigator review prior to dossier consolidation.
          </p>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="py-8 text-center space-y-1 text-zinc-500 font-mono text-xs border border-dashed border-zinc-800 rounded-lg">
          <CheckCheck size={18} className="mx-auto text-emerald-500 mb-1" />
          No unresolved identity ambiguities detected in this dataset.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {matches.map((match, idx) => {
            const similarityPercent = Math.round(match.score * 100);

            return (
              <div
                key={idx}
                className="p-3 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-zinc-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-100 text-[13px]">
                      {match.candidate_name}
                    </span>
                    <span
                      className={`badge ${
                        match.status === "CONFIRMED"
                          ? "badge-verified"
                          : match.status === "PROBABLE"
                          ? "badge-demo"
                          : match.status === "POSSIBLE"
                          ? "badge-low"
                          : "badge-high"
                      } text-[8px]`}
                    >
                      {match.status}
                    </span>
                    {match.review_required && (
                      <span className="badge badge-high text-[8px] flex items-center gap-1">
                        <AlertTriangle size={10} /> REVIEW REQ
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-zinc-400 space-y-0.5">
                    {match.supporting_evidence?.map((ev, evIdx) => (
                      <div key={evIdx} className="flex items-center gap-1 text-[10px] text-zinc-400">
                        <span className="text-zinc-600">•</span>
                        <span>{ev}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-800 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 uppercase block">Similarity</span>
                    <span className="text-sm font-bold text-zinc-200">
                      {similarityPercent}%
                    </span>
                  </div>
                  <span className="text-[9px] text-zinc-500 mt-1">
                    Candidate ID: {match.candidate_id ? match.candidate_id.slice(0, 8) : "—"}
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
