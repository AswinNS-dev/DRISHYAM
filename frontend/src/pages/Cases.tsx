import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  FolderKanban, Search, Shield, Users, FileText,
  Network as NetworkIcon, Sparkles, CheckCircle2,
  ExternalLink, Layers
} from "lucide-react";

type CaseTab = "overview" | "firs" | "entities" | "evidence" | "leads";

export default function Cases() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<CaseTab>("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    api.cases().then((r) => {
      const list = r.cases || [];
      setCases(list);
      if (list.length > 0 && !selectedCaseId) {
        openCase(list[0].id);
      }
    });
  }, []);

  async function openCase(id: string) {
    setSelectedCaseId(id);
    setLoadingDetail(true);
    try {
      const d = await api.caseDetail(id);
      setDetail(d);
    } finally {
      setLoadingDetail(false);
    }
  }

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.case_number.toLowerCase().includes(search.toLowerCase()) ||
      c.crime_type.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || c.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg-void)]">
      {/* ── Left Column: Cases Navigation & Filter Panel ── */}
      <div
        className="w-96 shrink-0 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-panel-solid)]"
      >
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(168,85,247,0.15)",
                  border: "1px solid rgba(168,85,247,0.3)",
                }}
              >
                <FolderKanban size={16} className="text-[var(--neon-purple)]" />
              </div>
              <div>
                <h1 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Case Files
                </h1>
                <div className="text-[10px] font-mono text-[var(--text-muted)]">
                  {cases.length} REGISTERED INVESTIGATIONS
                </div>
              </div>
            </div>
            <span className="badge badge-purple text-[9px]">{cases.length} Active</span>
          </div>

          {/* Search Box */}
          <div className="relative mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search case #, syndicate, section..."
              className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] focus:border-[var(--neon-teal)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] outline-none"
            />
            <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
          </div>

          {/* Status Filters */}
          <div className="flex gap-1.5">
            {["all", "open", "under_investigation", "closed"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded text-[10px] font-mono uppercase transition-all ${
                  statusFilter === st
                    ? "bg-[rgba(45,212,191,0.15)] text-[var(--neon-teal)] border border-[rgba(45,212,191,0.3)]"
                    : "bg-[var(--bg-panel-raised)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]"
                }`}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Case List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {filteredCases.map((c) => {
            const isSelected = selectedCaseId === c.id;
            return (
              <div
                key={c.id}
                onClick={() => openCase(c.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${
                  isSelected
                    ? "bg-[rgba(45,212,191,0.08)] border-[var(--neon-teal)] shadow-[0_0_16px_rgba(45,212,191,0.1)]"
                    : "bg-[var(--bg-panel-raised)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-panel-hover)]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold text-[var(--neon-teal)]">
                    {c.case_number}
                  </span>
                  <span
                    className={`badge ${c.status === "open" ? "badge-medium" : "badge-low"}`}
                    style={{ fontSize: 8, padding: "1px 6px" }}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="text-xs font-bold text-[var(--text-primary)] leading-snug line-clamp-1">
                  {c.title}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[rgba(255,255,255,0.04)] text-[10px] font-mono text-[var(--text-muted)]">
                  <span>{c.district}</span>
                  <span className="text-[var(--neon-purple)]">{c.crime_type}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Column: Interactive Investigation Workspace ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-void)]">
        {loadingDetail ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-[var(--neon-teal)] border-t-transparent animate-spin" />
            <div className="text-xs font-mono text-[var(--neon-teal)] uppercase">
              Retrieving case dossier and associated evidence chains...
            </div>
          </div>
        ) : detail ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Case Dossier Banner */}
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-panel-solid)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-mono font-bold text-[var(--neon-teal)]">
                      {detail.case.case_number}
                    </span>
                    <span className="text-[var(--border-strong)]">·</span>
                    <span className="badge badge-purple text-[9px]">{detail.case.crime_type}</span>
                    <span className="text-[var(--border-strong)]">·</span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      SECTOR: {detail.case.district}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    {detail.case.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate("/network")}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(45,212,191,0.1)] text-[var(--neon-teal)] border border-[rgba(45,212,191,0.3)] hover:bg-[rgba(45,212,191,0.2)] transition-all flex items-center gap-1.5"
                  >
                    <NetworkIcon size={13} />
                    <span>Open Case Subgraph</span>
                  </button>
                </div>
              </div>

              {/* Investigation Workspace Tabs */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--border-subtle)]">
                {(
                  [
                    { id: "overview", label: "Overview & IPC", icon: Shield },
                    { id: "firs", label: `Linked FIRs (${detail.firs?.length || 0})`, icon: FileText },
                    { id: "entities", label: `Accused Entities (${detail.accused_entities?.length || 0})`, icon: Users },
                    { id: "evidence", label: "Chain of Custody", icon: Layers },
                    { id: "leads", label: "AI Investigation Leads", icon: Sparkles },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as CaseTab)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      activeTab === id
                        ? "bg-[rgba(45,212,191,0.12)] text-[var(--neon-teal)] font-semibold border border-[rgba(45,212,191,0.3)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-panel-raised)]"
                    }`}
                  >
                    <Icon size={13} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Body Viewport */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-6 max-w-5xl">
                  {/* Executive Summary Card */}
                  <div className="glass-panel p-5">
                    <div className="hud-label text-[10px] text-[var(--neon-teal)] mb-2">
                      EXECUTIVE INVESTIGATION SUMMARY
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      Investigation commenced regarding syndicated operations in {detail.case.district}. Multiple cross-jurisdiction FIRs correlate communication footprints, common vehicle sightings, and hawala transaction ledgers linked to primary ringleaders.
                    </p>
                    <div className="grid grid-cols-4 gap-4 mt-5 pt-4 border-t border-[var(--border-subtle)]">
                      <div>
                        <div className="hud-label text-[9px]">Opened Date</div>
                        <div className="text-xs font-mono text-[var(--text-primary)] mt-0.5">
                          {new Date(detail.case.opened_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="hud-label text-[9px]">Investigation Status</div>
                        <div className="text-xs font-mono text-[var(--neon-teal)] mt-0.5 uppercase">
                          {detail.case.status}
                        </div>
                      </div>
                      <div>
                        <div className="hud-label text-[9px]">Primary Sector</div>
                        <div className="text-xs font-mono text-[var(--text-primary)] mt-0.5">
                          {detail.case.district} Division
                        </div>
                      </div>
                      <div>
                        <div className="hud-label text-[9px]">FIR Count</div>
                        <div className="text-xs font-mono text-[var(--text-primary)] mt-0.5">
                          {detail.firs?.length || 0} Registered
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Legal Sections Card */}
                  <div className="glass-panel p-5">
                    <div className="hud-label text-[10px] text-[var(--neon-amber)] mb-3">
                      APPLICABLE STATUTORY SECTIONS (IPC / BNS)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["Sec 120B (Criminal Conspiracy)", "Sec 420 (Cheating)", "Sec 384 (Extortion)", "BNS 111 (Organized Crime)"].map((sec) => (
                        <div key={sec} className="px-3 py-1.5 rounded-lg bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.25)] text-xs font-mono text-[var(--neon-amber)]">
                          {sec}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: FIRS */}
              {activeTab === "firs" && (
                <div className="space-y-4 max-w-5xl">
                  {detail.firs?.map((f: any) => (
                    <div key={f.id} className="glass-panel p-5 neon-border-left">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-[var(--neon-teal)]" />
                          <span className="text-xs font-mono font-bold text-[var(--neon-teal)]">
                            {f.fir_number}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          Filed: {new Date(f.filed_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[rgba(6,9,15,0.4)] p-3 rounded-lg border border-[var(--border-subtle)] font-mono">
                        {f.narrative_text}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: ACCUSED ENTITIES */}
              {activeTab === "entities" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
                  {detail.accused_entities?.map((e: any, i: number) => (
                    <div key={i} className="glass-panel p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
                          {(e.name || "?").charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[var(--text-primary)]">{e.name}</div>
                          <div className="text-[10px] font-mono text-[var(--text-muted)]">
                            Confidence: {Math.round(e.confidence * 100)}%
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate("/network")}
                        className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--neon-teal)] text-[var(--text-muted)] hover:text-[var(--neon-teal)] transition-all"
                        title="Locate in Network"
                      >
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: EVIDENCE & CUSTODY */}
              {activeTab === "evidence" && (
                <div className="space-y-3 max-w-5xl">
                  {[
                    { id: "EVD-2026-091", title: "Digital Extraction Report — Mobile IMEI 9876543210", custody: "Cyber Forensics Lab", verified: true },
                    { id: "EVD-2026-114", title: "CCTV Surveillance Footage — Central Market Corridor", custody: "District Station Locker 3", verified: true },
                    { id: "EVD-2026-188", title: "Hawala Ledger Seizure — Account XXXX7788", custody: "Economic Offences Division", verified: true },
                  ].map((ev) => (
                    <div key={ev.id} className="glass-panel p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[rgba(45,212,191,0.1)] text-[var(--neon-teal)]">
                          <CheckCircle2 size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[var(--text-primary)]">{ev.title}</div>
                          <div className="text-[10px] font-mono text-[var(--text-muted)]">
                            Evidence Code: {ev.id} · Custody: {ev.custody}
                          </div>
                        </div>
                      </div>
                      <span className="badge badge-low text-[9px]">Verified Chain</span>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 5: AI LEADS */}
              {activeTab === "leads" && (
                <div className="space-y-4 max-w-5xl">
                  <div className="glass-panel p-5 border-l-2 border-[var(--neon-teal)]">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={14} className="text-[var(--neon-teal)]" />
                      <div className="text-xs font-bold text-[var(--neon-teal)]">
                        AUTOMATED INVESTIGATIVE HYPOTHESIS
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      Cross-case analysis links accused entities in this matter with previous extortion rackets in Central Sector through common burner SIM numbers and vehicle KA01AB1234. Recommend immediate surveillance verification on primary rendezvous points.
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => navigate("/network")}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--neon-teal)] text-[#08211d] hover:shadow-[0_0_12px_rgba(45,212,191,0.4)] transition-all"
                      >
                        Explore Corroborating Paths
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--text-muted)]">
            <FolderKanban size={48} className="opacity-20 mb-3" />
            <div className="text-sm font-semibold text-[var(--text-secondary)]">No Case Selected</div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Select a case from the directory on the left to open its investigation workspace.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
