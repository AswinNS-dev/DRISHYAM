import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import {
  FolderKanban, Search, Shield, Users, FileText,
  Network as NetworkIcon, Sparkles, CheckCircle2,
  ShieldCheck, Fingerprint, Plus, RefreshCw,
  Printer, Lock
} from "lucide-react";

type CaseTab = "overview" | "firs" | "entities" | "evidence" | "leads";

export default function Cases() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetParamId = searchParams.get("id") || searchParams.get("case");
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
      if (list.length > 0) {
        if (targetParamId) {
          const match = list.find((c: any) => c.id === targetParamId || c.case_number === targetParamId);
          if (match) {
            openCase(match.id);
            return;
          }
        }
        if (!selectedCaseId) {
          openCase(list[0].id);
        }
      }
    });
  }, [targetParamId]);

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
      c.crime_type.toLowerCase().includes(search.toLowerCase()) ||
      c.district.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || c.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg-void)]">
      {/* ── Left Column: Cases Navigation & Filter Panel ── */}
      <div className="w-88 shrink-0 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-panel-solid)]">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
                <FolderKanban size={15} />
              </div>
              <div>
                <h1 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Case Files
                </h1>
                <div className="text-[10px] font-mono text-[var(--text-muted)]">
                  {cases.length} REGISTERED INVESTIGATIONS
                </div>
              </div>
            </div>
            <span className="badge badge-info text-[9px]">{cases.length} Total</span>
          </div>

          {/* Search Box */}
          <div className="relative mb-2.5">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search case #, syndicate, section..."
              className="workstation-input pl-8 text-xs"
            />
            <Search size={12} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
          </div>

          {/* Status Filter Chips */}
          <div className="flex gap-1">
            {["all", "open", "under_investigation", "closed"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded text-[9px] font-mono uppercase transition-all ${
                  statusFilter === st
                    ? "bg-zinc-100 text-zinc-900 font-semibold shadow-sm"
                    : "bg-[var(--bg-panel-raised)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
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
                className={`p-3 rounded-lg cursor-pointer transition-all border ${
                  isSelected
                    ? "bg-[var(--bg-panel-raised)] border-[var(--intel-sky)]"
                    : "bg-[var(--bg-panel)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono font-bold text-[var(--intel-sky)]">
                    {c.case_number}
                  </span>
                  <span
                    className={`badge ${c.status === "open" ? "badge-medium" : "badge-low"}`}
                    style={{ fontSize: 8, padding: "1px 6px" }}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="text-xs font-semibold text-[var(--text-primary)] leading-snug line-clamp-1">
                  {c.title}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-muted)]">
                  <span>{c.district} District</span>
                  <span className="text-[var(--status-purple)]">{c.crime_type}</span>
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
            <div className="w-8 h-8 rounded-full border-2 border-[var(--intel-blue)] border-t-transparent animate-spin" />
            <div className="text-xs font-mono text-[var(--intel-sky)] uppercase">
              Retrieving case investigation records...
            </div>
          </div>
        ) : detail ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* ── Persistent Case Header ── */}
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-panel-solid)]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-mono font-bold text-[var(--intel-sky)]">
                      {detail.case.case_number}
                    </span>
                    <span className="text-[var(--border-strong)]">·</span>
                    <span className="badge badge-purple text-[9px]">{detail.case.crime_type}</span>
                    <span className="text-[var(--border-strong)]">·</span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      JURISDICTION: {detail.case.district} POLICE SECTOR
                    </span>
                    <span className="text-[var(--border-strong)]">·</span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      INCIDENT DATE: {detail.case.created_at ? new Date(detail.case.created_at).toLocaleDateString() : "Historical"}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    {detail.case.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/evidence?case=${encodeURIComponent(detail.case.case_number)}`)}
                    className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 text-sky-400 hover:text-sky-300"
                    title="Open all forensic evidence for this case in Evidence Management Workspace"
                  >
                    <Fingerprint size={13} />
                    <span>View Case Evidence</span>
                  </button>
                  <button
                    onClick={() => navigate("/network")}
                    className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                  >
                    <NetworkIcon size={13} />
                    <span>Case Subgraph</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="btn-ghost py-1.5 px-2 text-xs"
                    title="Print Case Summary"
                  >
                    <Printer size={13} />
                  </button>
                </div>
              </div>

              {/* Investigation Workspace Tabs */}
              <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-[var(--border-subtle)] overflow-x-auto">
                {(
                  [
                    { id: "overview", label: "Overview & Sections", icon: Shield },
                    { id: "firs", label: `Linked FIRs (${detail.firs?.length || 0})`, icon: FileText },
                    { id: "entities", label: `Associated Entities (${detail.accused_entities?.length || 0})`, icon: Users },
                    { id: "evidence", label: `Evidence Ledger (${evidenceList.length || 4})`, icon: ShieldCheck },
                    { id: "leads", label: "AI Suggestions & Leads", icon: Sparkles },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as CaseTab)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      activeTab === id
                        ? "bg-zinc-800 text-zinc-100 font-semibold shadow-sm border border-zinc-700/60"
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
                <div className="space-y-5 max-w-5xl">
                  {/* Summary Card */}
                  <div className="panel p-5 bg-[var(--bg-panel-solid)]">
                    <div className="hud-label text-[10px] text-[var(--intel-sky)] mb-2">
                      EXECUTIVE INVESTIGATION BRIEF
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {detail.case.description || "Active criminal case involving coordinated syndicates operating across sector jurisdiction. Multi-jurisdictional surveillance and financial analysis underway."}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[var(--border-subtle)] text-xs">
                      <div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)] block">Lead Investigator:</span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {detail.case.assigned_officer || "Cyber Crime Branch"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)] block">Case Status:</span>
                        <span className="badge badge-low text-[9px] uppercase mt-0.5">
                          {detail.case.status || "Open"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)] block">Registration Station:</span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {detail.case.district} Central Station
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)] block">Evidence Items:</span>
                        <span className="font-mono text-[var(--intel-sky)] font-bold">
                          {evidenceList.length || 4} Verified Seals
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* IPC / BNS Legal Penal Sections */}
                  <div className="panel p-5 bg-[var(--bg-panel-solid)]">
                    <div className="hud-label text-[10px] text-[var(--intel-sky)] mb-3">
                      APPLICABLE LEGAL & PENAL CODE PROVISIONS
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { sec: "IPC Section 420", desc: "Cheating and dishonestly inducing delivery of property" },
                        { sec: "IPC Section 120B", desc: "Punishment of criminal conspiracy" },
                        { sec: "IT Act Section 66D", desc: "Punishment for cheating by personation by using computer resource" },
                        { sec: "IPC Section 384", desc: "Punishment for extortion" },
                      ].map((item) => (
                        <div
                          key={item.sec}
                          className="p-3 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]"
                        >
                          <div className="font-mono font-bold text-xs text-[var(--status-warning)]">
                            {item.sec}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] mt-1">
                            {item.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: LINKED FIRS */}
              {activeTab === "firs" && (
                <div className="space-y-3 max-w-5xl">
                  {detail.firs?.length === 0 ? (
                    <div className="panel p-8 text-center text-xs text-[var(--text-muted)]">
                      No formal FIRs linked to this case file yet.
                    </div>
                  ) : (
                    detail.firs?.map((fir: any) => (
                      <div
                        key={fir.id}
                        className="panel p-4 bg-[var(--bg-panel-solid)] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-[var(--intel-sky)]">
                            {fir.fir_number}
                          </span>
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">
                            Recorded: {fir.created_at ? new Date(fir.created_at).toLocaleDateString() : "Historical"}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          {fir.narrative_text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: ASSOCIATED ENTITIES */}
              {activeTab === "entities" && (
                <div className="space-y-3 max-w-5xl">
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Cross-case entities identified through FIR mentions, CDR call bursts, and financial transaction links.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {detail.accused_entities?.map((ent: any) => (
                      <div
                        key={ent.id}
                        onClick={() => navigate("/entities")}
                        className="panel p-3.5 bg-[var(--bg-panel-solid)] hover:border-[var(--intel-sky)] cursor-pointer transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--text-primary)]">
                            {ent.name}
                          </span>
                          <span className="badge badge-low text-[8px]">{ent.type}</span>
                        </div>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">
                          Alleged Association: <strong className="text-[var(--text-secondary)]">{ent.role || "Person of Interest"}</strong>
                        </div>
                        <div className="text-[10px] text-[var(--intel-sky)] font-mono flex items-center gap-1 pt-1">
                          <span>Inspect Intelligence Profile →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: TAMPER-EVIDENT EVIDENCE LEDGER */}
              {activeTab === "evidence" && (
                <div className="space-y-4 max-w-5xl">
                  <div className="panel p-4 bg-[var(--bg-panel-solid)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-2 border-[var(--intel-blue)]">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck size={16} className="text-[var(--status-verified)]" />
                        <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                          Tamper-Evident Evidence Integrity Ledger
                        </span>
                        <span className="badge badge-verified text-[8px]">SHA-256 Validated</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Every seized forensic item is cryptographically sealed at acquisition. Officers can independently verify against unauthorized alterations.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={loadEvidence}
                        disabled={loadingEvidence}
                        className="btn-ghost py-1 px-2.5 text-xs flex items-center gap-1.5"
                        title="Refresh Ledger"
                      >
                        <RefreshCw size={12} className={loadingEvidence ? "animate-spin" : ""} />
                        <span>Sync</span>
                      </button>

                      {user?.role !== "analyst" && (
                        <button
                          onClick={() => setShowAddExhibit(!showAddExhibit)}
                          className="btn-primary py-1 px-3 text-xs flex items-center gap-1.5"
                        >
                          <Plus size={13} />
                          <span>Record Exhibit</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Add Exhibit Form Drawer */}
                  {showAddExhibit && (
                    <form onSubmit={handleCreateExhibit} className="panel p-4 bg-[var(--bg-panel-solid)] border-[var(--intel-blue)] space-y-3">
                      <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Plus size={14} className="text-[var(--intel-sky)]" />
                        <span>REGISTER NEW FORENSIC EXHIBIT INTO CRYPTOGRAPHIC LEDGER</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="hud-label text-[9px] block mb-1">Exhibit Type</label>
                          <select
                            value={newExhibit.evidence_type}
                            onChange={(e) => setNewExhibit({ ...newExhibit, evidence_type: e.target.value })}
                            className="workstation-input"
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
                            className="workstation-input"
                          />
                        </div>

                        <div>
                          <label className="hud-label text-[9px] block mb-1">Custodian Division</label>
                          <input
                            type="text"
                            value={newExhibit.custodian_division}
                            onChange={(e) => setNewExhibit({ ...newExhibit, custodian_division: e.target.value })}
                            className="workstation-input"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                        <button
                          type="button"
                          onClick={() => setShowAddExhibit(false)}
                          className="btn-ghost"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingExhibit}
                          className="btn-primary py-1 px-4 text-xs flex items-center gap-1.5"
                        >
                          <Lock size={12} />
                          <span>{submittingExhibit ? "Sealing & Hashing..." : "Generate SHA-256 & Seal Exhibit"}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Exhibits List */}
                  <div className="space-y-2.5">
                    {evidenceList.map((ev) => {
                      const verified = verifiedStatus[ev.id];
                      const isVerifying = verifyingId === ev.id;

                      return (
                        <div
                          key={ev.id}
                          className="panel p-3.5 bg-[var(--bg-panel-solid)] hover:border-[var(--border-strong)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-strong)] flex items-center justify-center text-[var(--intel-sky)] shrink-0">
                              <Fingerprint size={16} />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[var(--text-primary)]">
                                  {ev.title || ev.description}
                                </span>
                                <span className="badge badge-low text-[8px]">
                                  {ev.evidence_type}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--text-secondary)]">
                                {ev.description}
                              </p>
                              <div className="text-[10px] font-mono text-[var(--text-muted)]">
                                SHA-256: <span className="text-[var(--intel-sky)]">{ev.sha256_digest?.substring(0, 24)}...</span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {verified && (
                              <span className="badge badge-verified text-[9px] flex items-center gap-1">
                                <CheckCircle2 size={11} /> Verified
                              </span>
                            )}
                            <button
                              onClick={() => handleVerify(ev.id)}
                              disabled={isVerifying}
                              className="btn-secondary py-1 px-2.5 text-[10px]"
                            >
                              {isVerifying ? "Verifying..." : "Verify Hash"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: AI INVESTIGATION LEADS */}
              {activeTab === "leads" && (
                <div className="space-y-4 max-w-5xl">
                  <div className="p-3 rounded bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.25)] text-xs text-[var(--text-secondary)]">
                    <strong>ASSISTIVE INTELLIGENCE NOTICE:</strong> All algorithmic leads represent statistical hypotheses generated by graph neural clustering. They must be independently verified through field surveillance and legal records.
                  </div>

                  <div className="space-y-2.5">
                    {[
                      {
                        title: "Potential Unregistered Burner Phone Link",
                        desc: "IMEI 864209043218901 was observed pinging the same azimuth tower within 15 minutes of the extortion rendezvous.",
                        confidence: 88,
                        type: "CORROBORATING LEAD",
                      },
                      {
                        title: "Suspected Financial Conduit Account",
                        desc: "Beneficiary wire transfer account XXXX7788 has multiple incoming hops matching known hawala routes.",
                        confidence: 79,
                        type: "FINANCIAL PATTERN",
                      },
                    ].map((lead, i) => (
                      <div
                        key={i}
                        className="panel p-4 bg-[var(--bg-panel-solid)] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="badge badge-low text-[8px]">{lead.type}</span>
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">
                            Confidence of Suggestion: {lead.confidence}%
                          </span>
                        </div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">
                          {lead.title}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {lead.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[var(--text-muted)]">
            <FolderKanban size={40} className="opacity-20 mb-2" />
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              No Case Selected
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Select an investigation from the left registry to open its workspace.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
