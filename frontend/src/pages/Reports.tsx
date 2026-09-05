import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  FileCheck2, Plus, Search, Printer,
  FileText, Sparkles
} from "lucide-react";

export default function Reports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  // Generate modal
  const [showGenModal, setShowGenModal] = useState(false);
  const [reportType, setReportType] = useState("Comprehensive Syndicate Dossier");
  const [genLoading, setGenLoading] = useState(false);

  function loadReports() {
    setLoading(true);
    api.intelligenceReports()
      .then((res) => {
        const list = res.reports || [];
        setReports(list);
        if (list.length > 0 && !selectedReport) {
          openReport(list[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadReports();
  }, []);

  function openReport(reportId: string) {
    api.intelligenceReportDetail(reportId)
      .then((res) => setSelectedReport(res.report))
      .catch((e) => alert("Failed to fetch report detail: " + e.message));
  }

  async function handleGenerateReport() {
    setGenLoading(true);
    try {
      const res = await api.generateReport(undefined, reportType);
      const updated = await api.intelligenceReports();
      setReports(updated.reports || []);
      setShowGenModal(false);
      if (res.report_id) {
        openReport(res.report_id);
      }
    } catch (e: any) {
      alert("Report generation failed: " + e.message);
    } finally {
      setGenLoading(false);
    }
  }

  const filteredReports = reports.filter((r) =>
    !search ||
    r.title?.toLowerCase().includes(search.toLowerCase()) ||
    r.id?.toLowerCase().includes(search.toLowerCase()) ||
    r.report_type?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg-void)]">
      {/* ── Left Column: Reports List ── */}
      <div className="w-88 shrink-0 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-panel-solid)]">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
                <FileCheck2 size={15} />
              </div>
              <div>
                <h1 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Intelligence Reports
                </h1>
                <div className="text-[10px] font-mono text-[var(--text-muted)]">
                  {reports.length} ARCHIVED DOSSIERS
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowGenModal(true)}
              className="btn-primary py-1 px-2.5 text-[10px] flex items-center gap-1"
            >
              <Plus size={12} />
              <span>Compile</span>
            </button>
          </div>

          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports..."
              className="workstation-input pl-7 text-xs"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {loading ? (
            [1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded" />)
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-10 text-xs text-[var(--text-muted)]">
              No reports indexed.
            </div>
          ) : (
            filteredReports.map((r) => {
              const isSelected = selectedReport?.id === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => openReport(r.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-all border ${
                    isSelected
                      ? "bg-[var(--bg-panel-raised)] border-[var(--intel-sky)] text-[var(--text-bright)]"
                      : "bg-[var(--bg-panel)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-primary)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="badge badge-low text-[8px]">{r.report_type || "INTELLIGENCE BRIEF"}</span>
                    <span className="text-[9px] font-mono text-[var(--text-muted)]">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : "2026"}
                    </span>
                  </div>
                  <div className="text-xs font-semibold line-clamp-1">{r.title}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                    ID: {r.id}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Column: Report Viewer & Print Layout ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-void)]">
        {selectedReport ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Action Bar */}
            <div className="px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel-solid)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="badge badge-verified text-[9px]">OFFICIAL POLICE DOSSIER</span>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  REPORT REF: {selectedReport.id}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="btn-secondary py-1 px-3 text-xs flex items-center gap-1.5"
                >
                  <Printer size={13} />
                  <span>Print Dossier</span>
                </button>
              </div>
            </div>

            {/* Document Content Viewport */}
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
              <div className="panel p-8 bg-[var(--bg-panel-solid)] border border-[var(--border-strong)] space-y-6">
                {/* Official Letterhead Header */}
                <div className="border-b border-[var(--border-strong)] pb-4 text-center">
                  <div className="text-xs font-mono tracking-widest uppercase text-[var(--text-muted)] font-bold">
                    CENTRAL INVESTIGATION DIVISION · STATE POLICE CRIME BRANCH
                  </div>
                  <h1 className="text-base font-bold text-[var(--text-bright)] mt-1">
                    {selectedReport.title}
                  </h1>
                  <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                    Compiled Date: {selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleString() : "2026"} IST
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="space-y-2">
                  <div className="hud-label text-[10px] text-[var(--intel-sky)]">
                    1. EXECUTIVE INVESTIGATION SUMMARY
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-panel-raised)] p-3.5 rounded border border-[var(--border-subtle)]">
                    {selectedReport.summary || selectedReport.content || "Comprehensive network synthesis report compiled from multi-source FIR filings, Call Detail Records, seized exhibits, and verified forensic extractions."}
                  </p>
                </div>

                {/* Structured Findings */}
                {selectedReport.sections?.map((sec: any, idx: number) => (
                  <div key={idx} className="space-y-2">
                    <div className="hud-label text-[10px] text-[var(--intel-sky)]">
                      {idx + 2}. {sec.title?.toUpperCase()}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] leading-relaxed space-y-2">
                      <p>{sec.body || sec.content}</p>
                    </div>
                  </div>
                ))}

                {/* Notice & Disclaimer */}
                <div className="border-t border-[var(--border-subtle)] pt-4 text-[10px] text-[var(--text-muted)] leading-relaxed">
                  <strong>CONFIDENTIALITY NOTICE:</strong> This intelligence document is generated for authorized law-enforcement and judicial proceedings only. All associative linkages represent investigative leads requiring verification by the investigating officer before charge-sheet filing.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[var(--text-muted)]">
            <FileText size={40} className="opacity-20 mb-2" />
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              No Report Selected
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Select a report from the archive or compile a new case dossier.
            </p>
          </div>
        )}
      </div>

      {/* ── Compile Report Modal ── */}
      {showGenModal && (
        <div className="cmd-palette-backdrop" onClick={() => setShowGenModal(false)}>
          <div className="cmd-palette-modal max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <FileCheck2 size={16} className="text-[var(--intel-sky)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Compile Intelligence Dossier
                </h2>
              </div>
              <button onClick={() => setShowGenModal(false)} className="text-xs font-mono text-[var(--text-muted)]">
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <label className="hud-label text-[9px] block mb-1">Dossier Template Format</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="workstation-input"
                >
                  <option value="Comprehensive Syndicate Dossier">Comprehensive Syndicate Dossier</option>
                  <option value="Court-Admissible Evidence Summary">Court-Admissible Evidence Summary</option>
                  <option value="Executive Officer Briefing">Executive Officer Briefing</option>
                  <option value="Financial Flow & Hawala Reconstruction">Financial Flow & Hawala Reconstruction</option>
                </select>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                The intelligence synthesizer will assemble active case records, verified evidence digests, and entity association graphs into an authoritative dossier.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
              <button onClick={() => setShowGenModal(false)} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={genLoading}
                className="btn-primary flex items-center gap-1.5"
              >
                <Sparkles size={13} />
                <span>{genLoading ? "Synthesizing Dossier..." : "Generate Official Report"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
