import { useState, useMemo } from "react";
import { Search, Eye, ExternalLink, Sparkles, FolderKanban, FileSpreadsheet, RefreshCw } from "lucide-react";
import type { DatasetItem, CaseOption } from "../../types/dataWorkspace";

interface Props {
  datasets: DatasetItem[];
  selectedDatasetId: string | null;
  onSelectDataset: (datasetId: string) => void;
  onOpenPreview: (dataset: DatasetItem) => void;
  onOpenDetails: (dataset: DatasetItem) => void;
  onAnalyze: (dataset: DatasetItem) => void;
  cases: CaseOption[];
  loading?: boolean;
  onRefresh?: () => void;
}

export default function DatasetListTable({
  datasets,
  selectedDatasetId,
  onSelectDataset,
  onOpenPreview,
  onOpenDetails,
  onAnalyze,
  cases,
  loading,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [caseFilter, setCaseFilter] = useState("ALL");

  const filteredDatasets = useMemo(() => {
    return datasets.filter((d) => {
      if (search.trim()) {
        const term = search.toLowerCase();
        const matchesName = d.name.toLowerCase().includes(term);
        const matchesType = d.job_type.toLowerCase().includes(term);
        const matchesCase = (d.case_number || "").toLowerCase().includes(term);
        if (!matchesName && !matchesType && !matchesCase) return false;
      }
      if (statusFilter !== "ALL") {
        if (d.status.toUpperCase() !== statusFilter.toUpperCase() &&
            d.validation_status.toUpperCase() !== statusFilter.toUpperCase()) {
          return false;
        }
      }
      if (typeFilter !== "ALL") {
        if (d.job_type.toUpperCase() !== typeFilter.toUpperCase()) {
          return false;
        }
      }
      if (caseFilter !== "ALL") {
        if (d.case_id !== caseFilter) {
          return false;
        }
      }
      return true;
    });
  }, [datasets, search, statusFilter, typeFilter, caseFilter]);

  function getStatusBadge(status: string) {
    switch (status.toUpperCase()) {
      case "COMPLETED":
      case "VALIDATED":
      case "PROCESSED":
        return "badge-verified";
      case "PROCESSING":
      case "VALIDATING":
        return "badge-demo";
      case "REQUIRES_REVIEW":
        return "badge-high";
      case "FAILED":
        return "badge-critical";
      default:
        return "badge-low";
    }
  }

  return (
    <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] overflow-hidden space-y-3 p-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search datasets by title, type, case reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-zinc-500 focus:outline-none focus:border-[var(--border-strong)] font-mono"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-zinc-300 text-xs focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="FIR">FIR Incident</option>
            <option value="CDR">CDR Telecom</option>
            <option value="FINANCIAL">Financial</option>
            <option value="SURVEILLANCE">Surveillance</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-zinc-300 text-xs focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="VALIDATED">Validated</option>
            <option value="PROCESSING">Processing</option>
            <option value="REQUIRES_REVIEW">Requires Review</option>
          </select>

          <select
            value={caseFilter}
            onChange={(e) => setCaseFilter(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-zinc-300 text-xs focus:outline-none max-w-[150px] truncate"
          >
            <option value="ALL">All Cases</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.case_number}
              </option>
            ))}
          </select>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel-raised)] hover:bg-[var(--bg-panel-hover)] text-zinc-300 transition-colors disabled:opacity-50"
              title="Refresh dataset inventory"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {/* Dataset Table */}
      {loading ? (
        <div className="py-16 text-center space-y-2">
          <RefreshCw size={20} className="animate-spin mx-auto text-zinc-400" />
          <p className="text-xs font-mono text-zinc-400">Loading datasets inventory...</p>
        </div>
      ) : filteredDatasets.length === 0 ? (
        <div className="py-16 text-center space-y-2 border border-dashed border-zinc-800 rounded-lg">
          <FileSpreadsheet size={22} className="mx-auto text-zinc-600" />
          <p className="text-xs font-mono text-zinc-400">
            {search || statusFilter !== "ALL" || typeFilter !== "ALL"
              ? "No datasets matched your active search/filter criteria."
              : "No datasets have been imported yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-void)]">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel-raised)]">
                <th className="py-2.5 px-3 hud-label text-[10px] text-zinc-400">DATASET / SOURCE</th>
                <th className="py-2.5 px-3 hud-label text-[10px] text-zinc-400">TYPE</th>
                <th className="py-2.5 px-3 hud-label text-[10px] text-zinc-400">RECORDS</th>
                <th className="py-2.5 px-3 hud-label text-[10px] text-zinc-400">STATUS</th>
                <th className="py-2.5 px-3 hud-label text-[10px] text-zinc-400">ASSOCIATED CASE</th>
                <th className="py-2.5 px-3 hud-label text-[10px] text-zinc-400">IMPORTED AT</th>
                <th className="py-2.5 px-3 hud-label text-[10px] text-zinc-400 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredDatasets.map((d) => {
                const isSelected = d.id === selectedDatasetId;
                const statusBadge = getStatusBadge(d.validation_status || d.status);

                return (
                  <tr
                    key={d.id}
                    onClick={() => onSelectDataset(d.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-zinc-900/90 border-l-2 border-l-zinc-100"
                        : "hover:bg-[var(--bg-panel-hover)]"
                    }`}
                  >
                    {/* Dataset Name */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-zinc-100 truncate max-w-[220px]">
                        {d.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate max-w-[220px]">
                        {d.filename || `ID: ${d.id.slice(0, 8)}`}
                      </div>
                    </td>

                    {/* Data Type */}
                    <td className="py-2.5 px-3">
                      <span className="badge badge-low text-[9px] uppercase">
                        {d.job_type}
                      </span>
                    </td>

                    {/* Record Count & Entities */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="text-zinc-200 font-bold">{d.record_count.toLocaleString()} rows</div>
                      <div className="text-[10px] text-zinc-500">
                        {d.entities_extracted} entities
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`badge ${statusBadge} text-[8px]`}>
                        {d.validation_status || d.status}
                      </span>
                    </td>

                    {/* Associated Case */}
                    <td className="py-2.5 px-3">
                      {d.case_number ? (
                        <div className="flex items-center gap-1 text-zinc-300 text-[11px] truncate max-w-[140px]">
                          <FolderKanban size={11} className="text-zinc-400 shrink-0" />
                          <span className="truncate">{d.case_number}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Imported At */}
                    <td className="py-2.5 px-3 text-zinc-400 text-[11px] whitespace-nowrap">
                      {d.created_at
                        ? new Date(d.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onOpenPreview(d)}
                          className="px-2 py-1 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:bg-[var(--bg-panel-hover)] text-zinc-200 text-[11px] flex items-center gap-1 transition-colors"
                          title="Preview records"
                        >
                          <Eye size={11} />
                          <span>Preview</span>
                        </button>

                        <button
                          onClick={() => onOpenDetails(d)}
                          className="px-2 py-1 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:bg-[var(--bg-panel-hover)] text-zinc-200 text-[11px] flex items-center gap-1 transition-colors"
                          title="Dataset details"
                        >
                          <ExternalLink size={11} />
                          <span>Details</span>
                        </button>

                        <button
                          onClick={() => onAnalyze(d)}
                          className="px-2 py-1 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-100 text-[11px] flex items-center gap-1 transition-colors"
                          title="Analyze Extracted Entities"
                        >
                          <Sparkles size={11} className="text-amber-300" />
                          <span>Analyze</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
