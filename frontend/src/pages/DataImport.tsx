import { useState } from "react";
import { api } from "../lib/api";
import { Upload, Scan, CheckCircle } from "lucide-react";

const SAMPLE = "Ravi alias Rocky met Arjun near Central Market. They used vehicle KA01AB1234 and phone 9876543210. The transaction was routed through account XXXX7788.";

const TYPE_COLORS: Record<string, { badge: string; color: string }> = {
  PERSON: { badge: "badge-info", color: "#5b8def" },
  ALIAS: { badge: "badge-low", color: "#2dd4bf" },
  PHONE: { badge: "badge-low", color: "#2dd4bf" },
  VEHICLE: { badge: "badge-medium", color: "#fbbf24" },
  LOCATION: { badge: "badge-purple", color: "#a855f7" },
  ORGANIZATION: { badge: "badge-high", color: "#ff3b5c" },
  GANG: { badge: "badge-high", color: "#ff3b5c" },
  BANK_ACCOUNT: { badge: "badge-medium", color: "#fbbf24" },
  FIR_NUMBER: { badge: "badge-demo", color: "#fbbf24" },
  CASE_NUMBER: { badge: "badge-demo", color: "#fbbf24" },
  DATE: { badge: "badge-low", color: "#2dd4bf" },
  LEGAL_SECTION: { badge: "badge-demo", color: "#fbbf24" },
  CRIME_TYPE: { badge: "badge-high", color: "#ff3b5c" },
};

export default function DataImport() {
  const [text, setText] = useState(SAMPLE);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function runExtraction() {
    setLoading(true);
    try {
      const res = await api.importFir(text);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(45,212,191,0.1)",
          boxShadow: "0 0 16px rgba(0,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Upload size={18} color="var(--neon-teal)" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Data Import</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            FIR / Report Ingestion Pipeline
          </p>
        </div>
      </div>
      <p className="text-xs mb-5 ml-12" style={{ color: "var(--text-secondary)" }}>
        Paste an FIR narrative, investigation note, or surveillance report. DRISHYAM's NLP pipeline extracts
        entities live, resolves them against existing records, and shows confidence + the extraction rule used.
      </p>

      {/* Text area with line number gutter */}
      <div className="glass-panel overflow-hidden mb-4">
        <div className="flex">
          {/* Gutter */}
          <div className="py-3 px-2 text-right select-none shrink-0"
               style={{
                 background: "rgba(6,9,15,0.5)",
                 borderRight: "1px solid var(--border-subtle)",
                 color: "var(--text-muted)",
                 fontFamily: "var(--font-mono)",
                 fontSize: 11,
                 lineHeight: "1.6em",
                 minWidth: 32,
               }}>
            {text.split("\n").map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          {/* Textarea */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="flex-1 bg-transparent p-3 text-sm outline-none resize-none"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--text-primary)",
              lineHeight: "1.6em",
            }}
          />
        </div>
      </div>

      <button
        onClick={runExtraction}
        disabled={loading}
        className="btn-primary flex items-center gap-2 mb-6"
      >
        {loading ? (
          <>
            <Scan size={14} className="pulse-dot" />
            ANALYZING...
          </>
        ) : (
          <>
            <Scan size={14} />
            RUN ENTITY EXTRACTION
          </>
        )}
      </button>

      {/* Results */}
      {result && (
        <div className="glass-panel p-5 scale-in">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} color="var(--neon-teal)" />
              <span className="text-sm font-bold">
                Extracted Entities ({result.entity_count})
              </span>
            </div>
            <span className="badge badge-demo">{result.data_classification}</span>
          </div>

          <div className="space-y-2 stagger-in">
            {result.extracted_entities.map((e: any, i: number) => {
              const typeStyle = TYPE_COLORS[e.type] || { badge: "badge-low", color: "#2dd4bf" };
              return (
                <div key={i}
                  className="flex items-center gap-3 py-3 px-3 rounded-lg transition-all"
                  style={{
                    borderLeft: `3px solid ${typeStyle.color}`,
                    boxShadow: `inset 3px 0 12px ${typeStyle.color}10`,
                    background: "var(--bg-panel-raised)",
                  }}
                >
                  <CheckCircle size={14} color="var(--neon-teal)" style={{ opacity: 0.6, flexShrink: 0 }} />
                  <span className="font-medium w-40 truncate text-sm">{e.text}</span>
                  <span className={`badge ${typeStyle.badge}`} style={{ fontSize: 9 }}>{e.type}</span>
                  <div className="flex-1">
                    <div className="confidence-bar">
                      <div className="confidence-fill" style={{ width: `${e.confidence * 100}%` }} />
                    </div>
                  </div>
                  <span className="mono w-10 text-right text-xs font-bold" style={{ color: "var(--neon-teal)" }}>
                    {Math.round(e.confidence * 100)}%
                  </span>
                  <span className="mono w-40 truncate text-right text-xs" style={{ color: "var(--text-muted)" }}
                        title={e.rule}>
                    {e.rule}
                  </span>
                  {e.resolution && (
                    <span className="badge badge-medium" style={{ fontSize: 9 }}
                          title={`${e.resolution.candidate_name} — ${e.resolution.evidence.join(", ")}`}>
                      {e.resolution.status} match
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
