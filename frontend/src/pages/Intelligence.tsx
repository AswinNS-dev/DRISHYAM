import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  Brain, Zap, FileText, GitBranch,
  ArrowRight, Sparkles, Target,
  Eye, ChevronRight, X
} from "lucide-react";

type TabType = "leads" | "reports" | "hidden-links";

export default function Intelligence() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("leads");
  const [leads, setLeads] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [hiddenLinks, setHiddenLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Report detail modal
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  // Generate report modal
  const [showGenModal, setShowGenModal] = useState(false);
  const [reportType, setReportType] = useState("Comprehensive Syndicate Dossier");
  const [genLoading, setGenLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.intelligenceLeads().catch(() => ({ leads: [] })),
      api.intelligenceReports().catch(() => ({ reports: [] })),
      api.intelligenceHiddenLinks().catch(() => ({ findings: [] })),
    ]).then(([leadsRes, reportsRes, hiddenRes]) => {
      setLeads(leadsRes.leads || []);
      setReports(reportsRes.reports || []);
      setHiddenLinks(hiddenRes.findings || []);
      setLoading(false);
    });
  }, []);

  async function handleGenerateReport() {
    setGenLoading(true);
    try {
      const res = await api.generateReport(undefined, reportType);
      const updated = await api.intelligenceReports();
      setReports(updated.reports || []);
      setShowGenModal(false);
      if (res.report_id) {
        const detail = await api.intelligenceReportDetail(res.report_id);
        setSelectedReport(detail.report);
      }
    } catch (e: any) {
      alert("Report generation failed: " + e.message);
    } finally {
      setGenLoading(false);
    }
  }

  function openReport(reportId: string) {
    api.intelligenceReportDetail(reportId)
      .then((res) => setSelectedReport(res.report))
      .catch((e) => alert("Failed to fetch report: " + e.message));
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-void)]">
      {/* ── Top HUD Header ── */}
      <div
        className="px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 glass-panel"
        style={{ borderColor: "var(--border-subtle)", borderRadius: 0 }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(45,212,191,0.2), rgba(0,255,255,0.05))",
              border: "1px solid rgba(45,212,191,0.3)",
              boxShadow: "0 0 12px rgba(45,212,191,0.2)",
            }}
          >
            <Brain size={18} color="var(--neon-teal)" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wide uppercase text-[var(--text-primary)]">
                Proactive Intelligence & Neural Synthesizer
              </h1>
              <span className="hud-label text-[9px] text-[var(--neon-teal)]">AI SYNTHESIS v2.4</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Algorithmic pattern recognition, syndicate broker detection, and automated legal dossiers
            </p>
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={() => setShowGenModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--neon-teal)] text-[#08211d] hover:shadow-[0_0_12px_rgba(45,212,191,0.4)] transition-all"
        >
          <Sparkles size={14} />
          <span>Generate Intelligence Report</span>
        </button>
      </div>

      {/* ── Tab Bar ── */}
      <div className="px-6 pt-3 border-b border-[var(--border-subtle)] bg-[rgba(10,14,24,0.4)] flex gap-2">
        {(
          [
            { id: "leads", label: "Tactical Leads", count: leads.length, icon: Zap },
            { id: "reports", label: "Intelligence Reports", count: reports.length, icon: FileText },
            { id: "hidden-links", label: "Hidden Multi-Hop Links", count: hiddenLinks.length, icon: GitBranch },
          ] as const
        ).map(({ id, label, count, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as TabType)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
              activeTab === id
                ? "text-[var(--neon-teal)] border-[var(--neon-teal)] bg-[rgba(45,212,191,0.08)] shadow-[0_-2px_10px_rgba(45,212,191,0.1)]"
                : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]"
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                activeTab === id ? "bg-[rgba(45,212,191,0.2)] text-[var(--neon-teal)]" : "bg-[rgba(255,255,255,0.06)] text-[var(--text-muted)]"
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass-panel p-5 rounded-xl animate-pulse h-28 border border-[var(--border-subtle)]" />
            ))}
          </div>
        ) : (
          <>
            {/* 1. TACTICAL LEADS TAB */}
            {activeTab === "leads" && (
              <div className="space-y-4">
                {leads.length === 0 ? (
                  <div className="text-center py-16 text-xs text-[var(--text-muted)]">
                    No active algorithmic leads detected.
                  </div>
                ) : (
                  leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="glass-panel p-4 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--neon-teal)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`badge text-[9px] ${
                              lead.priority === "CRITICAL"
                                ? "badge-critical"
                                : lead.priority === "HIGH"
                                ? "badge-high"
                                : "badge-medium"
                            }`}
                          >
                            {lead.priority} PRIORITY
                          </span>
                          <span className="text-[10px] font-mono text-[var(--neon-teal)]">
                            [{lead.lead_type}]
                          </span>
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">
                            Confidence: {(lead.confidence * 100).toFixed(0)}%
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-[var(--text-primary)]">{lead.title}</h3>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-3xl">
                          {lead.description}
                        </p>

                        <div className="text-[11px] text-[var(--neon-amber)] font-mono flex items-center gap-1.5 pt-1">
                          <Target size={12} />
                          <span>Recommended Action: {lead.recommended_action}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          onClick={() => navigate("/network")}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(45,212,191,0.1)] text-[var(--neon-teal)] border border-[rgba(45,212,191,0.3)] hover:bg-[rgba(45,212,191,0.2)] transition-all flex items-center gap-1.5"
                        >
                          <Eye size={12} />
                          Inspect Graph
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 2. REPORTS TAB */}
            {activeTab === "reports" && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {reports.length === 0 ? (
                  <div className="col-span-full text-center py-16 text-xs text-[var(--text-muted)]">
                    No intelligence reports generated yet. Click "Generate Intelligence Report" to create one.
                  </div>
                ) : (
                  reports.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => openReport(r.id)}
                      className="glass-panel p-5 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--neon-teal)] transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-[rgba(45,212,191,0.1)] text-[var(--neon-teal)] border border-[rgba(45,212,191,0.2)]">
                            {r.report_type}
                          </span>
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : "Recent"}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2 line-clamp-2">
                          {r.title}
                        </h3>

                        <div className="text-[10px] font-mono text-[var(--accent-red)] uppercase tracking-wider mb-3">
                          {r.classification}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--neon-teal)]">
                        <span className="font-semibold flex items-center gap-1">
                          <FileText size={12} /> View Full Report
                        </span>
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 3. HIDDEN MULTI-HOP LINKS TAB */}
            {activeTab === "hidden-links" && (
              <div className="space-y-3">
                {hiddenLinks.length === 0 ? (
                  <div className="text-center py-16 text-xs text-[var(--text-muted)]">
                    No indirect multi-hop associations discovered at this threshold.
                  </div>
                ) : (
                  hiddenLinks.map((h, i) => (
                    <div
                      key={i}
                      className="glass-panel p-4 rounded-xl border border-[rgba(244,63,94,0.25)] bg-[rgba(244,63,94,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="badge badge-high text-[9px]">{h.hop_count} INTERMEDIARY HOPS</span>
                          <span className="text-xs font-bold text-[var(--text-primary)]">
                            {h.source_name} <span className="text-[var(--neon-teal)]">⟷</span> {h.target_name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono text-[var(--text-muted)]">
                          {h.path_names?.map((name: string, idx: number) => (
                            <span key={idx} className="flex items-center gap-1">
                              <span
                                className={`px-2 py-0.5 rounded ${
                                  idx === 0 || idx === h.path_names.length - 1
                                    ? "bg-[rgba(244,63,94,0.15)] text-[var(--accent-red)] font-bold"
                                    : "bg-[rgba(45,212,191,0.1)] text-[var(--neon-teal)]"
                                }`}
                              >
                                {name}
                              </span>
                              {idx < h.path_names.length - 1 && <ArrowRight size={12} className="text-[var(--text-muted)]" />}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => navigate("/network")}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--neon-teal)] text-[#08211d] hover:shadow-[0_0_10px_rgba(45,212,191,0.3)] transition-all flex items-center gap-1.5"
                      >
                        <Target size={12} />
                        Trace on Canvas
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Generate Report Modal ── */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel p-6 rounded-2xl border border-[var(--border-subtle)] w-full max-w-md shadow-[0_0_30px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[var(--neon-teal)]" />
                <h3 className="text-sm font-bold uppercase text-[var(--text-primary)]">Synthesize Intelligence Report</h3>
              </div>
              <button onClick={() => setShowGenModal(false)} className="text-[var(--text-muted)] hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono uppercase text-[var(--text-muted)] block mb-1">
                  Report Type Template
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)]"
                >
                  <option value="Comprehensive Syndicate Dossier">Comprehensive Syndicate Dossier</option>
                  <option value="Multi-Hop Asset & Conduit Analysis">Multi-Hop Asset & Conduit Analysis</option>
                  <option value="Financial Laundering Flow Report">Financial Laundering Flow Report</option>
                  <option value="Inter-District Gang Territorial Map">Inter-District Gang Territorial Map</option>
                </select>
              </div>

              <div className="p-3 rounded-lg bg-[rgba(45,212,191,0.05)] border border-[rgba(45,212,191,0.2)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Generates a formal, evidence-grounded intelligence summary with PageRank rankings, multi-cell bridge nodes, and verifiable provenance trails.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowGenModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateReport}
                  disabled={genLoading}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-[var(--neon-teal)] text-[#08211d] hover:shadow-[0_0_12px_rgba(45,212,191,0.3)] disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  <Brain size={13} />
                  {genLoading ? "Synthesizing Report..." : "Generate Report"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── View Report Detail Modal ── */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.85)] backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel p-6 rounded-2xl border border-[var(--border-subtle)] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <span className="text-[9px] font-mono uppercase text-[var(--neon-teal)]">
                  {selectedReport.report_type}
                </span>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                  {selectedReport.title}
                </h3>
              </div>
              <button onClick={() => setSelectedReport(null)} className="text-[var(--text-muted)] hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 font-mono text-xs">
              <div className="p-2.5 rounded bg-[rgba(244,63,94,0.1)] border border-[rgba(244,63,94,0.3)] text-[var(--accent-red)] text-[10px]">
                CLASSIFICATION: {selectedReport.content?.data_classification || "CONFIDENTIAL / LAW ENFORCEMENT ONLY"}
              </div>

              <div className="p-4 rounded-xl bg-[rgba(10,14,24,0.8)] border border-[var(--border-subtle)] space-y-3 font-sans text-xs leading-relaxed text-[var(--text-secondary)]">
                <div>
                  <strong className="text-[var(--text-primary)]">Target Subject:</strong>{" "}
                  {selectedReport.content?.generated_for || "Syndicate Network"}
                </div>
                <div>
                  <strong className="text-[var(--text-primary)]">Analytical Scope:</strong>{" "}
                  Network graph multi-hop topology, betweenness metrics, criminal associates.
                </div>
                {selectedReport.content?.centrality && (
                  <div className="p-3 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] space-y-1 font-mono text-[11px]">
                    <div>Degree Centrality: {(selectedReport.content.centrality.degree_centrality * 100).toFixed(1)}%</div>
                    <div>Betweenness Centrality: {(selectedReport.content.centrality.betweenness_centrality * 100).toFixed(1)}%</div>
                    <div>Role Classification: {selectedReport.content.centrality.role_label}</div>
                  </div>
                )}
                <p className="text-[11px] text-[var(--text-muted)] italic pt-2">
                  {selectedReport.content?.note || "AI-generated content in this report is analytical output, not a confirmed police finding."}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] flex justify-end gap-2">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
