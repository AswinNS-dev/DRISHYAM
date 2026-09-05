import { useState } from "react";
import { api } from "../lib/api";
import { Upload, Scan, CheckCircle2 } from "lucide-react";

const SAMPLE = "Ravi alias Rocky met Arjun near Central Market. They used vehicle KA01AB1234 and phone 9876543210. The transaction was routed through account XXXX7788.";

const TYPE_COLORS: Record<string, { badge: string }> = {
  PERSON: { badge: "badge-info" },
  ALIAS: { badge: "badge-low" },
  PHONE: { badge: "badge-low" },
  VEHICLE: { badge: "badge-medium" },
  LOCATION: { badge: "badge-purple" },
  ORGANIZATION: { badge: "badge-high" },
  GANG: { badge: "badge-high" },
  BANK_ACCOUNT: { badge: "badge-medium" },
  FIR_NUMBER: { badge: "badge-demo" },
  CASE_NUMBER: { badge: "badge-demo" },
  DATE: { badge: "badge-low" },
  LEGAL_SECTION: { badge: "badge-demo" },
  CRIME_TYPE: { badge: "badge-high" },
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
    <div className="p-6 max-w-4xl mx-auto page-enter space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
          <Upload size={16} />
        </div>
        <div>
          <h1 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
            Intelligence Data Ingestion Pipeline
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Automated entity extraction and identity resolution from police field notes and reports
          </p>
        </div>
      </div>

      <div className="p-3.5 rounded bg-[var(--bg-panel-solid)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] leading-relaxed">
        Paste an FIR narrative, witness statement, or surveillance report. The ingestion engine extracts person names, phone numbers, vehicle registrations, and bank conduits live, cross-referencing against existing database records.
      </div>

      {/* Text area with line number gutter */}
      <div className="panel overflow-hidden bg-[var(--bg-panel-solid)]">
        <div className="flex">
          {/* Gutter */}
          <div
            className="py-3 px-2 text-right select-none shrink-0 bg-[var(--bg-void)] border-r border-[var(--border-subtle)] text-[var(--text-muted)] font-mono text-[11px] min-w-[32px]"
          >
            {text.split("\n").map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          {/* Textarea */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="flex-1 bg-transparent p-3 text-xs outline-none resize-none font-mono text-[var(--text-primary)] leading-relaxed"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={runExtraction}
          disabled={loading}
          className="btn-primary flex items-center gap-1.5"
        >
          <Scan size={14} className={loading ? "animate-spin" : ""} />
          <span>{loading ? "Extracting Identifiers..." : "Run Entity Extraction"}</span>
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="panel p-5 bg-[var(--bg-panel-solid)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[var(--status-verified)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Extracted Identifiers ({result.entity_count})
              </span>
            </div>
            <span className="badge badge-verified text-[8px]">{result.data_classification || "CLASSIFIED"}</span>
          </div>

          <div className="space-y-2">
            {result.extracted_entities?.map((e: any, i: number) => {
              const typeStyle = TYPE_COLORS[e.type] || { badge: "badge-low" };
              return (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 px-3 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">{e.text}</span>
                    <span className={`badge ${typeStyle.badge} text-[8px]`}>{e.type}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    Confidence: {Math.round((e.confidence || 0.9) * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
