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
    <div className="flex h-full min-h-0 bg-[#020617]">
      {/* ── Left Column: Reports List ── */}
      <div className="w-96 shrink-0 flex flex-col border-r border-slate-800/90 bg-slate-900/95 shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800/90 bg-slate-950/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="badge badge-info text-[9px] font-mono tracking-wider font-bold py-0.5 px-2 bg-slate-800 text-sky-300 border border-sky-500/30 text-glow-sky">
              STATE INTELLIGENCE BRIEFINGS & DOSSIER EXPORTS
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-950 text-sky-400 border border-slate-800 flex items-center justify-center shadow-md">
                <FileCheck2 size={18} />
              </div>
              <div>
                <h1 className="text-sm font-black uppercase tracking-wider text-white text-glow-white">
                  Intelligence Reports
                </h1>
                <div className="text-[10px] font-mono text-slate-400">
                  {reports.length} ARCHIVED DOSSIERS
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowGenModal(true)}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-md shadow-sky-500/20 transition-all cursor-pointer"
            >
              <Plus size={13} />
              <span>Compile</span>
            </button>
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dossiers & reports..."
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition-all shadow-inner"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            [1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl bg-slate-900/80 border border-slate-800" />)
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500 font-mono">
              No reports indexed.
            </div>
          ) : (
            filteredReports.map((r) => {
              const isSelected = selectedReport?.id === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => openReport(r.id)}
                  className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? "bg-slate-900 border-sky-500/80 shadow-lg shadow-sky-950/40 text-white"
                      : "bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/50 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="badge badge-low text-[8px] font-mono">{r.report_type || "INTELLIGENCE BRIEF"}</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : "2026"}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white line-clamp-1 group-hover:text-sky-300">{r.title}</div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    ID: {r.id}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Column: Report Viewer & Print Layout ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#020617]">
        {selectedReport ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Action Bar */}
            <div className="px-6 py-3.5 border-b border-slate-800/90 bg-slate-900/95 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="badge badge-verified text-[9px] font-mono text-glow-emerald">OFFICIAL POLICE DOSSIER</span>
                <span className="text-[11px] font-mono text-slate-400">
                  REPORT REF: <strong className="text-white">{selectedReport.id}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Printer size={13} />
                  <span>Print Dossier</span>
                </button>
              </div>
            </div>

            {/* Document Content Viewport */}
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
              <div className="p-8 bg-slate-900/95 border border-slate-800/90 rounded-2xl shadow-2xl space-y-6">
                {/* Official Letterhead Header */}
                <div className="border-b border-slate-800 pb-5 text-center">
                  <div className="text-xs font-mono tracking-widest uppercase text-slate-400 font-bold">
                    CENTRAL INVESTIGATION DIVISION · STATE POLICE CRIME BRANCH
                  </div>
                  <h1 className="text-xl font-black text-white mt-1.5 uppercase text-glow-white tracking-wide">
                    {selectedReport.title}
                  </h1>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    Compiled Date: <strong className="text-slate-300">{selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleString() : "2026"} IST</strong>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="space-y-2">
                  <div className="text-[10px] font-mono uppercase text-sky-400 font-bold tracking-wider text-glow-sky">
                    1. EXECUTIVE INVESTIGATION SUMMARY
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/80 p-4 rounded-xl border border-slate-800 shadow-inner">
                    {selectedReport.summary || selectedReport.content || "Comprehensive network synthesis report compiled from multi-source FIR filings, Call Detail Records, seized exhibits, and verified forensic extractions."}
                  </p>
                </div>

                {/* Structured Findings */}
                {selectedReport.sections?.map((sec: any, idx: number) => (
                  <div key={idx} className="space-y-2">
                    <div className="text-[10px] font-mono uppercase text-sky-400 font-bold tracking-wider text-glow-sky">
                      {idx + 2}. {sec.title?.toUpperCase()}
                    </div>
                    <div className="text-xs text-slate-300 leading-relaxed space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                      <p>{sec.body || sec.content}</p>
                    </div>
                  </div>
                ))}

                {/* Notice & Disclaimer */}
                <div className="border-t border-slate-800 pt-4 text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-slate-300">CONFIDENTIALITY NOTICE:</strong> This intelligence document is generated for authorized law-enforcement and judicial proceedings only. All associative linkages represent investigative leads requiring verification by the investigating officer before charge-sheet filing.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
            <FileText size={44} className="opacity-20 mb-2 text-slate-500" />
            <div className="text-sm font-bold uppercase tracking-wider text-slate-300">
              No Report Selected
            </div>
            <p className="text-xs text-slate-500 max-w-sm">
              Select a report from the archive or compile a new case dossier.
            </p>
          </div>
        )}
      </div>

      {/* ── Compile Report Modal ── */}
      {showGenModal && (
        <div className="cmd-palette-backdrop" onClick={() => setShowGenModal(false)}>
          <div className="cmd-palette-modal max-w-md p-6 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCheck2 size={18} className="text-sky-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Compile Intelligence Dossier
                </h2>
              </div>
              <button onClick={() => setShowGenModal(false)} className="text-xs font-mono text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1.5 font-bold">Dossier Template Format</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
                >
                  <option value="Comprehensive Syndicate Dossier">Comprehensive Syndicate Dossier</option>
                  <option value="Court-Admissible Evidence Summary">Court-Admissible Evidence Summary</option>
                  <option value="Executive Officer Briefing">Executive Officer Briefing</option>
                  <option value="Financial Flow & Hawala Reconstruction">Financial Flow & Hawala Reconstruction</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                The intelligence synthesizer will assemble active case records, verified evidence digests, and entity association graphs into an authoritative dossier.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button onClick={() => setShowGenModal(false)} className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono text-xs">
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={genLoading}
                className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20"
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
