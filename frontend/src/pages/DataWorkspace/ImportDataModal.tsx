import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Upload, FileText, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { dataWorkspaceService } from "../../services/dataWorkspaceService";
import type { CaseOption } from "../../types/dataWorkspace";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDataset: any) => void;
  cases: CaseOption[];
}

export default function ImportDataModal({ isOpen, onClose, onSuccess, cases }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [datasetName, setDatasetName] = useState("");
  const [jobType, setJobType] = useState("fir");
  const [caseId, setCaseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Check size limit (max 10MB for prototype safety)
    if (selected.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit.");
      return;
    }

    setFile(selected);
    if (!datasetName) {
      setDatasetName(selected.name.replace(/\.[^/.]+$/, ""));
    }

    // Auto-detect type
    if (selected.name.endsWith(".json")) {
      setJobType("fir");
    } else if (selected.name.endsWith(".csv")) {
      setJobType("cdr");
    }

    // Read content
    const reader = new FileReader();
    reader.onload = (event) => {
      setContent(event.target?.result as string);
      setError(null);
    };
    reader.onerror = () => {
      setError("Failed to read selected file.");
    };
    reader.readAsText(selected);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError("Please select a valid dataset file or enter narrative text.");
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(25);

    try {
      // Simulate stepped progression for deterministic feedback
      const progressTimer = setInterval(() => {
        setProgress((prev) => (prev < 85 ? prev + 20 : prev));
      }, 250);

      const res = await dataWorkspaceService.uploadDataset({
        dataset_name: datasetName.trim() || file?.name || undefined,
        job_type: jobType,
        case_id: caseId || undefined,
        content: content.trim(),
        file_name: file?.name,
        file_size_bytes: file?.size || content.length,
      });

      clearInterval(progressTimer);
      setProgress(100);
      setSuccessData(res);
      setTimeout(() => {
        onSuccess(res);
      }, 750);
    } catch (err: any) {
      setError(err?.message || "Upload failed. The dataset was not imported.");
      setProgress(0);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setFile(null);
    setContent("");
    setDatasetName("");
    setCaseId("");
    setError(null);
    setSuccessData(null);
    setProgress(0);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-[var(--bg-panel-solid)] border border-[var(--border-strong)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] my-auto animate-[fadeIn_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] flex items-center justify-center text-zinc-200">
              <Upload size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] font-mono">
                IMPORT INVESTIGATION DATASET
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Ingest intelligence records into backend verification pipeline
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

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 font-mono text-xs">
          {successData ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 size={36} className="mx-auto text-emerald-400" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-100 uppercase">
                  Dataset Successfully Ingested
                </h3>
                <p className="text-zinc-400 text-xs">
                  {successData.name} ({successData.record_count} records, {successData.entities_extracted_count} entities extracted)
                </p>
              </div>
              <div className="p-3 bg-zinc-950/80 rounded-lg border border-zinc-800 text-left space-y-1 max-w-md mx-auto text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Validation Status:</span>
                  <span className="text-emerald-400 font-bold">{successData.validation?.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Entities Extracted:</span>
                  <span className="text-zinc-200">{successData.entities_extracted_count}</span>
                </div>
                {successData.case_number && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Associated Case:</span>
                    <span className="text-zinc-200">{successData.case_number}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                className="btn-primary px-4 py-1.5 text-xs mt-2"
              >
                Close & Return to Workspace
              </button>
            </div>
          ) : (
            <form onSubmit={handleUpload} className="space-y-4">
              {/* File Dropzone */}
              <div>
                <label className="hud-label text-[10px] block mb-1.5 text-zinc-400">
                  SELECT DATASET FILE (CSV, JSON, TXT)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-5 rounded-xl border border-dashed border-zinc-700 hover:border-zinc-500 bg-zinc-950/60 cursor-pointer text-center space-y-2 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-2 text-zinc-200 font-medium">
                      <FileText size={16} className="text-zinc-300" />
                      <span>{file.name}</span>
                      <span className="text-zinc-500 text-[10px]">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ) : (
                    <>
                      <Upload size={20} className="mx-auto text-zinc-500" />
                      <div className="text-zinc-300 text-xs">
                        Click to browse or drop an investigation dataset
                      </div>
                      <div className="text-zinc-600 text-[10px]">
                        Supported formats: .CSV, .JSON, .TXT (max 10MB)
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Dataset Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="hud-label text-[10px] block mb-1 text-zinc-400">
                    DATASET TITLE
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Operation Hawk Field Notes"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="hud-label text-[10px] block mb-1 text-zinc-400">
                    DATA TYPE / SOURCE
                  </label>
                  <select
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
                  >
                    <option value="fir">FIR / Incident Narrative</option>
                    <option value="cdr">Call Detail Records (CDR)</option>
                    <option value="financial">Financial Conduits</option>
                    <option value="surveillance">Surveillance Field Report</option>
                  </select>
                </div>
              </div>

              {/* Case Association */}
              <div>
                <label className="hud-label text-[10px] block mb-1 text-zinc-400">
                  ASSOCIATE WITH CRIME CASE (OPTIONAL)
                </label>
                <select
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-zinc-200 text-xs focus:outline-none focus:border-zinc-500"
                >
                  <option value="">No Direct Case Linkage (Unassigned Evidence)</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number} — {c.title} ({c.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Raw Text View/Edit fallback */}
              {(!file || content.length < 2000) && (
                <div>
                  <label className="hud-label text-[10px] block mb-1 text-zinc-400">
                    OR PASTE RAW RECORDS / NARRATIVE CONTENT
                  </label>
                  <textarea
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste CSV rows, JSON array, or police narrative statements here..."
                    className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-[11px] leading-relaxed resize-none focus:outline-none focus:border-zinc-600 font-mono"
                  />
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Progress Bar */}
              {loading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>Validating schema & running NER extraction...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-100 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-panel-raised)] text-zinc-400 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !content.trim()}
                  className="btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-40"
                >
                  {loading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Ingesting Dataset...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={13} />
                      <span>Ingest & Validate</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
