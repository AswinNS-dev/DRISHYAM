import { useState } from "react";
import { api } from "../lib/api";
import { UploadCloud } from "lucide-react";

const SAMPLE = "Ravi alias Rocky met Arjun near Central Market. They used vehicle KA01AB1234 and phone 9876543210. The transaction was routed through account XXXX7788.";

const TYPE_COLOR: Record<string, string> = {
  PERSON: "badge-medium", ALIAS: "badge-low", PHONE: "badge-low", VEHICLE: "badge-medium",
  LOCATION: "badge-low", ORGANIZATION: "badge-high", GANG: "badge-high", BANK_ACCOUNT: "badge-medium",
  FIR_NUMBER: "badge-demo", CASE_NUMBER: "badge-demo", DATE: "badge-low", LEGAL_SECTION: "badge-demo",
  CRIME_TYPE: "badge-high",
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
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-1">
        <UploadCloud size={18} color="var(--accent-teal)" />
        <h1 className="text-lg font-semibold">Data Import — FIR / Report Ingestion</h1>
      </div>
      <p className="text-xs text-[var(--text-secondary)] mb-4">
        Paste an FIR narrative, investigation note, or surveillance report. DRISHYAM's NLP pipeline extracts
        entities live, resolves them against existing records, and shows confidence + the extraction rule used
        before anything enters the graph.
      </p>

      <textarea
        value={text} onChange={(e) => setText(e.target.value)}
        rows={5}
        className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg p-3 text-sm outline-none focus:border-[var(--accent-teal)] mono"
      />
      <button
        onClick={runExtraction} disabled={loading}
        className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-teal)] text-[#08211d] disabled:opacity-50"
      >
        {loading ? "Extracting..." : "Run Entity Extraction"}
      </button>

      {result && (
        <div className="mt-6 panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold">Extracted Entities ({result.entity_count})</div>
            <span className="badge badge-demo">{result.data_classification}</span>
          </div>
          <div className="space-y-2">
            {result.extracted_entities.map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-xs py-2 border-b border-[var(--border-subtle)] last:border-0">
                <span className="text-[var(--accent-teal)]">✓</span>
                <span className="font-medium w-40 truncate">{e.text}</span>
                <span className={`badge ${TYPE_COLOR[e.type] || "badge-low"}`}>{e.type}</span>
                <div className="flex-1">
                  <div className="confidence-bar"><div className="confidence-fill" style={{ width: `${e.confidence * 100}%` }} /></div>
                </div>
                <span className="mono w-10 text-right">{Math.round(e.confidence * 100)}%</span>
                <span className="text-[var(--text-muted)] w-40 truncate text-right" title={e.rule}>{e.rule}</span>
                {e.resolution && (
                  <span className="badge badge-medium" title={`${e.resolution.candidate_name} — ${e.resolution.evidence.join(", ")}`}>
                    {e.resolution.status} match
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
