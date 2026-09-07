import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban,
  ExternalLink,
  Table,
  ShieldCheck,
  Scan,
  UserCheck,
  Activity
} from "lucide-react";
import type { DatasetDetail } from "../../types/dataWorkspace";
import DataPreviewPanel from "./DataPreviewPanel";
import DataValidationCard from "./DataValidationCard";
import ProcessingPipelineTracker from "./ProcessingPipelineTracker";
import EntityExtractionView from "./EntityExtractionView";
import EntityResolutionPanel from "./EntityResolutionPanel";

interface Props {
  detail: DatasetDetail;
  onClose?: () => void;
  defaultTab?: "preview" | "validation" | "entities" | "resolution" | "pipeline";
}

export default function DatasetDetailsPanel({ detail, onClose, defaultTab = "preview" }: Props) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"preview" | "validation" | "entities" | "resolution" | "pipeline">(
    defaultTab
  );

  const { dataset, validation, pipeline, entity_groups, extracted_entities, potential_matches } = detail;

  return (
    <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] overflow-hidden space-y-4 p-4">
      {/* Header Info Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-low text-[9px] uppercase font-mono">{dataset.job_type}</span>
            <h2 className="text-sm font-bold text-[var(--text-primary)] font-mono tracking-wide uppercase">
              {dataset.name}
            </h2>
            <span className="badge badge-verified text-[9px] font-mono">{dataset.status}</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono text-[var(--text-muted)] flex-wrap pt-0.5">
            <span>Records: <strong className="text-zinc-200">{dataset.record_count.toLocaleString()}</strong></span>
            <span>Entities: <strong className="text-zinc-200">{dataset.entities_extracted}</strong></span>
            {dataset.created_at && (
              <span>
                Ingested:{" "}
                <strong className="text-zinc-300">
                  {new Date(dataset.created_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </strong>
              </span>
            )}
            {dataset.filename && (
              <span>Ref: <code className="text-zinc-400">{dataset.filename}</code></span>
            )}
          </div>
        </div>

        {/* Case Linkage Action */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {dataset.case ? (
            <button
              onClick={() => navigate(`/cases?case_id=${dataset.case?.id}`)}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-xs font-mono flex items-center gap-1.5 transition-colors shadow-sm"
              title="Navigate to Associated Crime Case"
            >
              <FolderKanban size={13} className="text-amber-400" />
              <span>Case: {dataset.case.case_number}</span>
              <ExternalLink size={11} className="text-zinc-400" />
            </button>
          ) : (
            <div className="px-2.5 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-500 text-[11px] font-mono">
              Unassociated Dataset
            </div>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel-raised)] hover:bg-[var(--bg-panel-hover)] text-zinc-400 hover:text-zinc-200 text-xs font-mono transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border-subtle)] pb-2 font-mono text-xs">
        <button
          onClick={() => setActiveTab("preview")}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
            activeTab === "preview"
              ? "bg-zinc-100 text-zinc-900 font-bold shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <Table size={13} />
          <span>Preview Records</span>
        </button>

        <button
          onClick={() => setActiveTab("validation")}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
            activeTab === "validation"
              ? "bg-zinc-100 text-zinc-900 font-bold shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <ShieldCheck size={13} />
          <span>Validation ({validation.status})</span>
        </button>

        <button
          onClick={() => setActiveTab("pipeline")}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
            activeTab === "pipeline"
              ? "bg-zinc-100 text-zinc-900 font-bold shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <Activity size={13} />
          <span>Pipeline Tracker</span>
        </button>

        <button
          onClick={() => setActiveTab("entities")}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
            activeTab === "entities"
              ? "bg-zinc-100 text-zinc-900 font-bold shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <Scan size={13} />
          <span>Extracted Entities ({extracted_entities.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("resolution")}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
            activeTab === "resolution"
              ? "bg-zinc-100 text-zinc-900 font-bold shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          }`}
        >
          <UserCheck size={13} />
          <span>Potential Matches ({potential_matches.length})</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "preview" && (
          <DataPreviewPanel
            datasetId={dataset.id}
            datasetName={dataset.name}
            jobType={dataset.job_type}
            status={dataset.status}
          />
        )}

        {activeTab === "validation" && (
          <DataValidationCard validation={validation} />
        )}

        {activeTab === "pipeline" && (
          <ProcessingPipelineTracker steps={pipeline} />
        )}

        {activeTab === "entities" && (
          <EntityExtractionView
            entities={extracted_entities}
            entityGroups={entity_groups}
          />
        )}

        {activeTab === "resolution" && (
          <EntityResolutionPanel matches={potential_matches} />
        )}
      </div>
    </div>
  );
}
