import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import {
  FolderKanban, Search, Shield, Users, FileText,
  Network as NetworkIcon, Sparkles, CheckCircle2,
  ExternalLink, ShieldCheck, Fingerprint, Plus, RefreshCw
} from "lucide-react";

type CaseTab = "overview" | "firs" | "entities" | "evidence" | "leads";

export default function Cases() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<CaseTab>("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Evidence & Integrity State
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifiedStatus, setVerifiedStatus] = useState<Record<string, any>>({});
  const [showAddExhibit, setShowAddExhibit] = useState(false);
  const [newExhibit, setNewExhibit] = useState({
    evidence_type: "DIGITAL_EXTRACTION",
    description: "",
    custodian_division: "District Cyber Forensics Lab",
  });
  const [submittingExhibit, setSubmittingExhibit] = useState(false);

  useEffect(() => {
    api.cases().then((r) => {
      const list = r.cases || [];
      setCases(list);
      if (list.length > 0 && !selectedCaseId) {
        openCase(list[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (activeTab === "evidence" && selectedCaseId) {
      loadEvidence();
    }
  }, [activeTab, selectedCaseId]);

  async function loadEvidence() {
    setLoadingEvidence(true);
    try {
      const res = await api.evidence(selectedCaseId || undefined);
      setEvidenceList(res.evidence || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEvidence(false);
    }
  }

  async function handleVerify(id: string) {
    setVerifyingId(id);
    try {
      const res = await api.verifyEvidence(id);
      setVerifiedStatus((prev) => ({ ...prev, [id]: res }));
    } catch (e) {
      console.error(e);
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleCreateExhibit(e: React.FormEvent) {
    e.preventDefault();
    if (!newExhibit.description) return;
    setSubmittingExhibit(true);
    try {
      await api.registerEvidence({
        ...newExhibit,
        case_id: selectedCaseId,
      });
      setNewExhibit({
        evidence_type: "DIGITAL_EXTRACTION",
        description: "",
        custodian_division: "District Cyber Forensics Lab",
      });
      setShowAddExhibit(false);
      loadEvidence();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingExhibit(false);
    }
  }

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
                    { id: "evidence", label: `Integrity Ledger (${evidenceList.length || 4})`, icon: ShieldCheck },
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

              {/* TAB 4: EVIDENCE & TAMPER-EVIDENT INTEGRITY LEDGER */}
              {activeTab === "evidence" && (
                <div className="space-y-4 max-w-5xl">
                  {/* Ledger Banner & Header */}
                  <div className="glass-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-2 border-[var(--neon-teal)]">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck size={16} className="text-[var(--neon-teal)]" />
                        <span className="text-xs font-bold text-[var(--neon-teal)] uppercase tracking-wider">
                          Tamper-Evident Evidence Integrity Ledger
                        </span>
                        <span className="badge badge-low text-[8px]">SHA-256 Hash Chaining</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Every seized forensic item is cryptographically sealed at acquisition. Officers can independently verify against unauthorized alterations.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={loadEvidence}
                        disabled={loadingEvidence}
                        className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--neon-teal)] text-xs text-[var(--text-muted)] hover:text-[var(--neon-teal)] transition-all flex items-center gap-1.5"
                        title="Refresh Ledger"
                      >
                        <RefreshCw size={12} className={loadingEvidence ? "animate-spin" : ""} />
                        <span>Sync</span>
                      </button>

                      {(user?.role === "investigator" || user?.role === "admin") && (
                        <button
                          onClick={() => setShowAddExhibit(!showAddExhibit)}
                          className="btn-primary py-1.5 px-3 text-xs font-bold uppercase flex items-center gap-1.5"
                        >
                          <Plus size={13} />
                          <span>Record Seized Exhibit</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Add Exhibit Form Drawer */}
                  {showAddExhibit && (
                    <form onSubmit={handleCreateExhibit} className="glass-panel p-4 border border-[var(--neon-teal)] space-y-3">
                      <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Plus size={14} className="text-[var(--neon-teal)]" />
                        <span>REGISTER NEW FORENSIC EXHIBIT INTO CRYPTOGRAPHIC LEDGER</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="hud-label text-[9px] block mb-1">Exhibit Type</label>
                          <select
                            value={newExhibit.evidence_type}
                            onChange={(e) => setNewExhibit({ ...newExhibit, evidence_type: e.target.value })}
                            className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] focus:border-[var(--neon-teal)] rounded-lg p-2 text-xs text-[var(--text-primary)] outline-none"
                          >
                            <option value="DIGITAL_EXTRACTION">Digital Extraction (Mobile/PC)</option>
                            <option value="CCTV_SURVEILLANCE">CCTV Surveillance Footage</option>
                            <option value="FINANCIAL_LEDGER">Financial / Hawala Ledger</option>
                            <option value="CDR_LOGS">Telecom Tower CDR Logs</option>
                            <option value="PHYSICAL_SEIZURE">Physical Evidence Item</option>
                          </select>
                        </div>

                        <div>
                          <label className="hud-label text-[9px] block mb-1">Seizure Description</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Seized iPhone 14 IMEI ..., recovered at safehouse"
                            value={newExhibit.description}
                            onChange={(e) => setNewExhibit({ ...newExhibit, description: e.target.value })}
                            className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] focus:border-[var(--neon-teal)] rounded-lg p-2 text-xs text-[var(--text-primary)] outline-none"
                          />
                        </div>

                        <div>
                          <label className="hud-label text-[9px] block mb-1">Custodian Division</label>
                          <input
                            type="text"
                            value={newExhibit.custodian_division}
                            onChange={(e) => setNewExhibit({ ...newExhibit, custodian_division: e.target.value })}
                            className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] focus:border-[var(--neon-teal)] rounded-lg p-2 text-xs text-[var(--text-primary)] outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                        <button
                          type="button"
                          onClick={() => setShowAddExhibit(false)}
                          className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingExhibit}
                          className="btn-primary py-1.5 px-4 text-xs font-bold uppercase flex items-center gap-1.5"
                        >
                          {submittingExhibit ? "Sealing & Hashing..." : "Generate SHA-256 & Seal Exhibit"}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Exhibit Ledger List */}
                  {loadingEvidence ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs font-mono text-[var(--neon-teal)]">
                      <div className="w-6 h-6 rounded-full border-2 border-[var(--neon-teal)] border-t-transparent animate-spin" />
                      <span>Validating cryptographic hash chain...</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {evidenceList.map((ev) => {
                        const verified = verifiedStatus[ev.id];
                        const isVerifying = verifyingId === ev.id;

                        return (
                          <div
                            key={ev.id}
                            className="glass-panel p-4 transition-all border border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div
                                  className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center ${
                                    verified
                                      ? "bg-[rgba(45,212,191,0.15)] text-[var(--neon-teal)] border border-[rgba(45,212,191,0.3)]"
                                      : "bg-[var(--bg-panel-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)]"
                                  }`}
                                >
                                  {verified ? <CheckCircle2 size={18} /> : <Fingerprint size={18} />}
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-[var(--text-primary)]">
                                      {ev.title || ev.description}
                                    </span>
                                    <span className="badge badge-purple text-[8px]">
                                      {ev.evidence_type}
                                    </span>
                                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                                      EXHIBIT ID: {ev.id}
                                    </span>
                                  </div>

                                  <div className="text-[11px] text-[var(--text-secondary)]">
                                    {ev.description}
                                  </div>

                                  <div className="flex items-center gap-3 pt-1 text-[10px] font-mono text-[var(--text-muted)]">
                                    <span>Locker: {ev.custody}</span>
                                    <span>·</span>
                                    <span>Seized: {new Date(ev.created_at).toLocaleString()}</span>
                                  </div>

                                  {/* Cryptographic SHA-256 Digest */}
                                  <div className="mt-2 p-2 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] flex items-center gap-2">
                                    <Fingerprint size={12} className="text-[var(--neon-teal)] shrink-0" />
                                    <span className="text-[9px] font-mono text-[var(--text-muted)] shrink-0">SHA-256 DIGEST:</span>
                                    <span className="text-[10px] font-mono text-[var(--neon-teal)] truncate">
                                      {ev.sha256_digest}
                                    </span>
                                  </div>

                                  {/* Verification Report Banner */}
                                  {verified && (
                                    <div className="mt-2 p-2.5 rounded-lg bg-[rgba(45,212,191,0.08)] border border-[rgba(45,212,191,0.3)] flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2 text-[var(--neon-teal)]">
                                        <CheckCircle2 size={14} className="shrink-0" />
                                        <span className="text-[11px] font-medium">
                                          {verified.message || "Integrity confirmed: Digital signature matches original seizure state."}
                                        </span>
                                      </div>
                                      <span className="text-[9px] font-mono text-[var(--text-muted)] shrink-0">
                                        Checked by {verified.verified_by}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Action Button */}
                              <div className="shrink-0 flex items-center gap-2 self-end sm:self-start">
                                {verified ? (
                                  <span className="badge badge-low text-[9px] font-mono py-1 px-2 flex items-center gap-1">
                                    <CheckCircle2 size={11} />
                                    <span>VERIFIED — TAMPER-PROOF MATCH</span>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleVerify(ev.id)}
                                    disabled={isVerifying}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(45,212,191,0.1)] text-[var(--neon-teal)] border border-[rgba(45,212,191,0.3)] hover:bg-[rgba(45,212,191,0.2)] transition-all flex items-center gap-1.5"
                                  >
                                    <ShieldCheck size={13} className={isVerifying ? "animate-spin" : ""} />
                                    <span>{isVerifying ? "Verifying..." : "Verify Hash Integrity"}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
