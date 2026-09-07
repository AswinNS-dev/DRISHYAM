import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, FileText, AlertCircle, Database } from "lucide-react";
import { dataWorkspaceService } from "../../services/dataWorkspaceService";
import type { PreviewData } from "../../types/dataWorkspace";

interface Props {
  datasetId: string;
  datasetName: string;
  jobType: string;
  status: string;
}

export default function DataPreviewPanel({
  datasetId,
  datasetName,
  jobType,
  status,
}: Props) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  async function loadPreview(targetPage: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await dataWorkspaceService.getDatasetPreview(datasetId, targetPage, pageSize);
      setData(res);
      setPage(res.page || targetPage);
    } catch (err: any) {
      setError(err?.message || "Failed to load dataset records preview.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview(1);
  }, [datasetId]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total_records / pageSize)) : 1;

  return (
    <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] flex items-center justify-center text-zinc-300">
            <Database size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-wide uppercase">
                {datasetName}
              </h3>
              <span className="badge badge-low text-[9px] font-mono">{jobType}</span>
              <span className="badge badge-verified text-[9px] font-mono">{status}</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
              Source: Database Ingestion Ledger · Total Registered Records: {data?.total_records?.toLocaleString() ?? "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => loadPreview(page)}
            disabled={loading}
            className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel-raised)] hover:bg-[var(--bg-panel-hover)] text-zinc-300 transition-colors disabled:opacity-50"
            title="Refresh records"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Narrative block if present */}
      {data?.narrative && (
        <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/60 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
            <FileText size={12} className="text-zinc-500" />
            <span className="uppercase font-bold tracking-wider">Original Ingested Narrative</span>
          </div>
          <p className="text-xs font-mono text-zinc-300 leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
            {data.narrative}
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="py-12 text-center space-y-3">
          <RefreshCw size={20} className="animate-spin mx-auto text-zinc-400" />
          <p className="text-xs font-mono text-zinc-400">Loading dataset records from storage...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="py-10 text-center space-y-2">
          <AlertCircle size={20} className="mx-auto text-rose-400" />
          <p className="text-xs font-mono text-rose-300">{error}</p>
          <button
            onClick={() => loadPreview(page)}
            className="text-xs font-mono underline text-zinc-400 hover:text-zinc-200 mt-2"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && (!data?.rows || data.rows.length === 0) && (
        <div className="py-12 text-center space-y-2 border border-dashed border-zinc-800 rounded-lg">
          <FileText size={20} className="mx-auto text-zinc-600" />
          <p className="text-xs font-mono text-zinc-400">No records found in this dataset.</p>
        </div>
      )}

      {/* Table State */}
      {!loading && !error && data && data.rows.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-void)]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel-raised)]">
                  {data.columns.map((col, idx) => (
                    <th
                      key={idx}
                      className="py-2.5 px-3 hud-label text-[10px] text-zinc-400 font-mono whitespace-nowrap font-semibold"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
                {data.rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-[var(--bg-panel-hover)] transition-colors text-[11px] text-zinc-200"
                  >
                    {data.columns.map((col, cIdx) => (
                      <td key={cIdx} className="py-2 px-3 whitespace-nowrap">
                        {typeof row[col] === "object"
                          ? JSON.stringify(row[col])
                          : (row[col]?.toString() ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pt-1">
            <span>
              Showing {((page - 1) * pageSize) + 1} to{" "}
              {Math.min(page * pageSize, data.total_records)} of{" "}
              {data.total_records.toLocaleString()} rows
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => loadPreview(page - 1)}
                disabled={page <= 1 || loading}
                className="p-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] hover:bg-[var(--bg-panel-hover)] disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 py-0.5 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-[11px] text-zinc-200">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => loadPreview(page + 1)}
                disabled={page >= totalPages || loading}
                className="p-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-panel)] hover:bg-[var(--bg-panel-hover)] disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
