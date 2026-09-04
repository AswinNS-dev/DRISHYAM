import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { FolderKanban } from "lucide-react";

export default function Cases() {
  const [cases, setCases] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => { api.cases().then((r) => setCases(r.cases)); }, []);

  async function openCase(id: string) {
    setLoadingDetail(true);
    try {
      const d = await api.caseDetail(id);
      setDetail(d);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div className="p-6 flex gap-6 h-full min-h-0 page-enter">
      {/* Case list */}
      <div className="w-96 shrink-0 overflow-auto flex flex-col">
        <div className="flex items-center gap-3 mb-5">
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(168,85,247,0.1)",
            boxShadow: "0 0 16px rgba(168,85,247,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FolderKanban size={18} color="#a855f7" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Cases</h1>
            <span className="hud-label" style={{ fontSize: 9 }}>{cases.length} investigations</span>
          </div>
        </div>

        <div className="space-y-2 stagger-in">
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => openCase(c.id)}
              className="w-full text-left glass-panel p-4 hover-lift transition-all"
              style={{
                cursor: "pointer",
                borderColor: detail?.case?.id === c.id ? "rgba(45,212,191,0.35)" : undefined,
                boxShadow: detail?.case?.id === c.id ? "0 0 20px rgba(0,255,255,0.08)" : undefined,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="mono text-xs" style={{ color: "var(--text-muted)" }}>{c.case_number}</span>
                <div className="flex items-center gap-1.5">
                  <div className={`glow-dot ${c.status === "open" ? "glow-dot-teal" : "glow-dot-blue"}`}
                       style={{ width: 6, height: 6 }} />
                  <span className="hud-label" style={{ fontSize: 8 }}>{c.status}</span>
                </div>
              </div>
              <div className="text-sm font-medium mt-2">{c.title}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="badge badge-purple" style={{ fontSize: 8, padding: "1px 6px" }}>
                  {c.crime_type}
                </span>
                <span className="hud-label" style={{ fontSize: 8 }}>
                  {c.district} · {c.fir_count} FIRs
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Case detail */}
      <div className="flex-1 min-w-0 overflow-auto">
        {!detail && !loadingDetail && (
          <div className="h-full flex flex-col items-center justify-center" style={{ color: "var(--text-muted)" }}>
            <FolderKanban size={48} style={{ opacity: 0.15 }} className="mb-4" />
            <div className="text-sm">Select a case to view its investigation workspace</div>
          </div>
        )}
        {loadingDetail && (
          <div className="space-y-4 p-4">
            <div className="skeleton" style={{ height: 120 }} />
            <div className="skeleton" style={{ height: 80 }} />
            <div className="skeleton" style={{ height: 200 }} />
          </div>
        )}
        {detail && (
          <div className="space-y-5 slide-in-right">
            {/* Case header */}
            <div className="glass-panel p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="mono text-xs" style={{ color: "var(--neon-teal)" }}>{detail.case.case_number}</span>
                <div className="flex items-center gap-1.5">
                  <div className={`glow-dot ${detail.case.status === "open" ? "glow-dot-teal" : "glow-dot-blue"}`}
                       style={{ width: 6, height: 6 }} />
                  <span className={`badge ${detail.case.status === "open" ? "badge-medium" : "badge-low"}`}>
                    {detail.case.status}
                  </span>
                </div>
              </div>
              <h2 className="text-lg font-bold mb-1">{detail.case.title}</h2>
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className="badge badge-purple" style={{ fontSize: 9 }}>{detail.case.crime_type}</span>
                <span>{detail.case.district}</span>
                <span>Opened {new Date(detail.case.opened_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Accused entities */}
            <div>
              <div className="hud-label mb-3" style={{ color: "var(--neon-teal)", fontSize: 10 }}>
                Accused / Linked Entities
              </div>
              <div className="flex flex-wrap gap-2">
                {detail.accused_entities.map((e: any, i: number) => (
                  <div key={i} className="glass-panel px-3 py-2.5 flex items-center gap-2">
                    <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                      {(e.name || "?").charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-medium">{e.name || "Unknown entity"}</div>
                      <div className="hud-label" style={{ fontSize: 8 }}>
                        {Math.round(e.confidence * 100)}% confidence
                      </div>
                    </div>
                  </div>
                ))}
                {detail.accused_entities.length === 0 && (
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>No accused entities recorded.</div>
                )}
              </div>
            </div>

            {/* FIRs */}
            <div>
              <div className="hud-label mb-3" style={{ color: "var(--neon-teal)", fontSize: 10 }}>
                FIRs ({detail.firs.length})
              </div>
              <div className="space-y-2">
                {detail.firs.map((f: any) => (
                  <div key={f.id} className="glass-panel p-4 neon-border-left">
                    <div className="flex items-center justify-between mb-2">
                      <span className="mono text-xs font-semibold" style={{ color: "var(--neon-teal)" }}>
                        {f.fir_number}
                      </span>
                      <span className="hud-label" style={{ fontSize: 8 }}>
                        {new Date(f.filed_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {f.narrative_text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
