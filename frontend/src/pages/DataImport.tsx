import { useState, useEffect } from "react";
import { Plus, RefreshCw, Database, FileText, AlertCircle } from "lucide-react";
import { dataWorkspaceService } from "../services/dataWorkspaceService";
import type {
  DatasetSummary,
  DatasetItem,
  DatasetDetail,
  CaseOption,
} from "../types/dataWorkspace";

import DataWorkspaceSummary from "./DataWorkspace/DataWorkspaceSummary";
import DatasetListTable from "./DataWorkspace/DatasetListTable";
import DatasetDetailsPanel from "./DataWorkspace/DatasetDetailsPanel";
import ImportDataModal from "./DataWorkspace/ImportDataModal";
import QuickTextAnalysisModal from "./DataWorkspace/QuickTextAnalysisModal";

export default function DataWorkspace() {
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active selected dataset details
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<DatasetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"preview" | "validation" | "entities" | "resolution" | "pipeline">("preview");

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isQuickTextModalOpen, setIsQuickTextModalOpen] = useState(false);

  async function loadWorkspaceData() {
    setLoading(true);
    setError(null);
    try {
      const [dsRes, casesRes] = await Promise.all([
        dataWorkspaceService.getDatasets(),
        dataWorkspaceService.getCases(),
      ]);
      setSummary(dsRes.summary);
      setDatasets(dsRes.datasets);
      setCases(casesRes);

      // Auto-select first dataset if none selected
      if (dsRes.datasets.length > 0 && !selectedDatasetId) {
        selectDataset(dsRes.datasets[0].id, "preview");
      }
    } catch (err: any) {
      setError(err?.message || "Unable to load investigation datasets. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function selectDataset(
    id: string,
    tab: "preview" | "validation" | "entities" | "resolution" | "pipeline" = "preview"
  ) {
    setSelectedDatasetId(id);
    setDetailTab(tab);
    setDetailLoading(true);
    try {
      const detail = await dataWorkspaceService.getDatasetDetail(id);
      setActiveDetail(detail);
    } catch (err: any) {
      console.error("Failed to load dataset details:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  function handleImportSuccess(newDataset: any) {
    loadWorkspaceData();
    if (newDataset?.dataset_id) {
      selectDataset(newDataset.dataset_id, "validation");
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto page-enter space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
            <Database size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] font-mono">
              DATA WORKSPACE
            </h1>
            <p className="text-xs text-[var(--text-muted)] font-mono">
              Import, inspect, validate and process investigation datasets.
            </p>
          </div>
        </div>

        {/* Primary Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsQuickTextModalOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel-raised)] hover:bg-[var(--bg-panel-hover)] text-zinc-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Ad-hoc FIR narrative entity extraction"
          >
            <FileText size={13} className="text-zinc-400" />
            <span>Extract Entities from Text</span>
          </button>

          <button
            onClick={loadWorkspaceData}
            disabled={loading}
            className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel-raised)] hover:bg-[var(--bg-panel-hover)] text-zinc-300 transition-colors disabled:opacity-50"
            title="Refresh datasets"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="btn-primary px-3.5 py-1.5 text-xs font-mono flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={14} />
            <span>+ Import Data</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs font-mono text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadWorkspaceData}
            className="underline hover:text-white font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── SUMMARY SECTION ── */}
      <DataWorkspaceSummary summary={summary} loading={loading} />

      {/* ── DATASET INVENTORY SECTION ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="hud-label text-[11px] font-mono tracking-wider text-[var(--text-muted)]">
            INVESTIGATION DATASETS INVENTORY
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            {datasets.length} Registered Sources
          </span>
        </div>

        <DatasetListTable
          datasets={datasets}
          selectedDatasetId={selectedDatasetId}
          onSelectDataset={(id) => selectDataset(id, "preview")}
          onOpenPreview={(d) => selectDataset(d.id, "preview")}
          onOpenDetails={(d) => selectDataset(d.id, "validation")}
          onAnalyze={(d) => selectDataset(d.id, "entities")}
          cases={cases}
          loading={loading}
          onRefresh={loadWorkspaceData}
        />
      </div>

      {/* ── SELECTED DATASET INSPECTOR & PROCESSING PIPELINE ── */}
      {selectedDatasetId && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between px-1">
            <span className="hud-label text-[11px] font-mono tracking-wider text-[var(--text-muted)]">
              ACTIVE DATASET INSPECTION & PIPELINE
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              ID: {selectedDatasetId}
            </span>
          </div>

          {detailLoading && !activeDetail ? (
            <div className="py-16 text-center rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-2">
              <RefreshCw size={20} className="animate-spin mx-auto text-zinc-400" />
              <p className="text-xs font-mono text-zinc-400">Loading dataset details & pipeline telemetry...</p>
            </div>
          ) : activeDetail ? (
            <DatasetDetailsPanel
              key={activeDetail.dataset.id}
              detail={activeDetail}
              defaultTab={detailTab}
            />
          ) : null}
        </div>
      )}

      {/* ── MODALS ── */}
      <ImportDataModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleImportSuccess}
        cases={cases}
      />

      <QuickTextAnalysisModal
        isOpen={isQuickTextModalOpen}
        onClose={() => setIsQuickTextModalOpen(false)}
        onImportComplete={loadWorkspaceData}
      />
    </div>
  );
}
