import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Scan, CheckCircle2, FileText, Sparkles } from "lucide-react";
import { dataWorkspaceService } from "../../services/dataWorkspaceService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

const SAMPLE =
  "Ravi alias Rocky met Arjun near Central Market. They used vehicle KA01AB1234 and phone 9876543210. The transaction was routed through account XXXX7788.";

const TYPE_BADGES: Record<string, string> = {
  PERSON: "badge-info",
  ALIAS: "badge-low",
  PHONE: "badge-low",
  VEHICLE: "badge-medium",
  LOCATION: "badge-purple",
  ORGANIZATION: "badge-high",
  GANG: "badge-high",
  BANK_ACCOUNT: "badge-medium",
  FIR_NUMBER: "badge-demo",
  CASE_NUMBER: "badge-demo",
  DATE: "badge-low",
  LEGAL_SECTION: "badge-demo",
  CRIME_TYPE: "badge-high",
};

export default function QuickTextAnalysisModal({
  isOpen,
  onClose,
  onImportComplete,
}: Props) {
  const [text, setText] = useState(SAMPLE);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function runExtraction() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await dataWorkspaceService.importFirText(text);
      setResult(res);
      onImportComplete?.();
    } catch (err: any) {
      setError(err?.message || "Failed to extract entities from narrative text.");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-[var(--bg-panel-solid)] border border-[var(--border-strong)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto animate-[fadeIn_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] flex items-center justify-center text-zinc-200">
              <Scan size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-mono">
                QUICK TEXT ANALYSIS & LIVE NER EXTRACTION
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Ad-hoc identity and identifier extraction from unstructured field notes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--bg-panel-raised)] text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="hud-label text-[10px] text-zinc-400">
              UNSTRUCTURED POLICE NARRATIVE / WITNESS STATEMENT
            </span>
            <button
              type="button"
              onClick={() => setText(SAMPLE)}
              className="text-[10px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 underline"
            >
              <FileText size={10} /> Load Demo Narrative
            </button>
          </div>

          {/* Gutter + Textarea */}
          <div className="rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-void)] flex">
            <div className="py-3 px-2 text-right select-none shrink-0 bg-zinc-950 border-r border-[var(--border-subtle)] text-zinc-600 font-mono text-[11px] min-w-[32px]">
              {text.split("\n").map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Paste incident narrative, field report, or interrogation notes..."
              className="flex-1 bg-transparent p-3 text-xs outline-none resize-none font-mono text-[var(--text-primary)] leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={runExtraction}
              disabled={loading || !text.trim()}
              className="btn-primary px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
            >
              <Scan size={13} className={loading ? "animate-spin" : ""} />
              <span>{loading ? "Extracting Identifiers..." : "Run Entity Extraction"}</span>
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Extraction Results */}
          {result && (
            <div className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                    Extracted Identifiers ({result.entity_count})
                  </span>
                </div>
                <span className="badge badge-verified text-[8px]">
                  {result.data_classification || "CLASSIFIED"}
                </span>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {result.extracted_entities?.map((e: any, i: number) => {
                  const badgeClass = TYPE_BADGES[e.type] || "badge-low";
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-100">{e.text}</span>
                        <span className={`badge ${badgeClass} text-[8px]`}>{e.type}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400">
                        Confidence: {Math.round((e.confidence || 0.9) * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 text-[10px] text-zinc-500 border-t border-zinc-800 flex items-center justify-between">
                <span>FIR Reference: {result.fir_number}</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <Sparkles size={11} /> Saved into Ingestion Ledger
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
