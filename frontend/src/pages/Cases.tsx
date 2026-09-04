import { useEffect, useState } from "react";
import { api } from "../lib/api";

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
    <div className="p-6 flex gap-6 h-full min-h-0">
      <div className="w-96 shrink-0 overflow-auto">
        <h1 className="text-lg font-semibold mb-4">Cases</h1>
        <div className="space-y-2">
          {cases.map((c) => (
            <button
              key={c.id} onClick={() => openCase(c.id)}
              className={`w-full text-left panel p-3 hover:border-[var(--accent-teal)] transition-colors ${detail?.case?.id === c.id ? "border-[var(--accent-teal)]" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="mono text-xs text-[var(--text-muted)]">{c.case_number}</span>
                <span className={`badge ${c.status === "open" ? "badge-medium" : "badge-low"}`}>{c.status}</span>
              </div>
              <div className="text-sm font-medium mt-1">{c.title}</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">{c.district} · {c.fir_count} FIR(s)</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-auto">
        {!detail && !loadingDetail && (
          <div className="text-sm text-[var(--text-muted)] mt-10 text-center">Select a case to view its investigation workspace.</div>
        )}
        {loadingDetail && <div className="text-sm text-[var(--text-muted)] mt-10 text-center">Loading...</div>}
        {detail && (
          <div className="space-y-6">
            <div className="panel p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="mono text-xs text-[var(--text-muted)]">{detail.case.case_number}</span>
                <span className={`badge ${detail.case.status === "open" ? "badge-medium" : "badge-low"}`}>{detail.case.status}</span>
              </div>
              <h2 className="text-lg font-semibold">{detail.case.title}</h2>
              <div className="text-xs text-[var(--text-secondary)] mt-1">
                {detail.case.crime_type} · {detail.case.district} · opened {new Date(detail.case.opened_at).toLocaleDateString()}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Accused / Linked Entities</h3>
              <div className="flex flex-wrap gap-2">
                {detail.accused_entities.map((e: any, i: number) => (
                  <div key={i} className="panel px-3 py-2 text-xs">
                    {e.name || "Unknown entity"} <span className="text-[var(--text-muted)]">· {Math.round(e.confidence * 100)}%</span>
                  </div>
                ))}
                {detail.accused_entities.length === 0 && <div className="text-xs text-[var(--text-muted)]">No accused entities recorded.</div>}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">FIRs ({detail.firs.length})</h3>
              <div className="space-y-2">
                {detail.firs.map((f: any) => (
                  <div key={f.id} className="panel p-3">
                    <div className="flex items-center justify-between">
                      <span className="mono text-xs text-[var(--accent-teal)]">{f.fir_number}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{new Date(f.filed_at).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">{f.narrative_text}</div>
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
