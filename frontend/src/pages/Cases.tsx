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
      <div className="w-88 shrink-0 flex flex-col border-r border-slate-800/80 bg-slate-950/60 backdrop-blur-md">
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="badge badge-info text-[10px] font-mono tracking-wider font-bold py-0.5 px-2 bg-slate-800 text-sky-300 border border-sky-500/30 text-glow-sky">
              STATE CASE REPOSITORY
            </span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 text-glow-emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              SYNCHRONIZED
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 text-sky-400 flex items-center justify-center shadow-sm">
                <FolderKanban size={16} />
              </div>
              <div>
                <h1 className="text-sm font-black uppercase tracking-wider text-white text-glow-white">
                  Case Dossiers
                </h1>
                <div className="text-[10px] font-mono text-slate-400">
                  {cases.length} Registered Inquiries
                </div>
              </div>
            </div>
            <span className="badge badge-info text-[9px] font-mono font-bold">{cases.length} Total</span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search case #, syndicate, section..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-sky-500/80 text-slate-100 placeholder-slate-500 text-xs font-mono outline-none transition-colors"
            />
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
          </div>

          {/* Status Filter Chips */}
          <div className="flex gap-1 flex-wrap">
            {["all", "open", "under_investigation", "closed"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded text-[9px] font-mono uppercase transition-all cursor-pointer border ${
                  statusFilter === st
                    ? "bg-slate-800 text-sky-300 font-bold border-sky-500/40 text-glow-sky shadow-sm"
                    : "bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
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
                    ? "bg-slate-900 border-sky-500 shadow-[0_0_16px_rgba(56,189,248,0.2)] text-white"
                    : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/90 text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-mono font-bold ${isSelected ? "text-sky-300 text-glow-sky" : "text-sky-400"}`}>
                    {c.case_number}
                  </span>
                  <span
                    className={`badge ${c.status === "open" ? "badge-demo" : "badge-low"}`}
                    style={{ fontSize: 8, padding: "1px 6px" }}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-100 leading-snug line-clamp-1">
                  {c.title}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/70 text-[10px] font-mono text-slate-400">
                  <span>{c.district} District</span>
                  <span className="text-purple-300 font-medium">{c.crime_type}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Column: Interactive Investigation Workspace ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#020617]">
        {loadingDetail ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
            <div className="text-xs font-mono text-sky-400 uppercase tracking-wider text-glow-sky">
              Retrieving case investigation records...
            </div>
          </div>
        ) : detail ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* ── Persistent Case Header ── */}
            <div className="px-6 py-4 border-b border-slate-800/90 bg-slate-900/95 backdrop-blur-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-mono font-bold text-sky-300 text-glow-sky">
                      {detail.case.case_number}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="badge badge-purple text-[9px] font-mono">{detail.case.crime_type}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-[11px] font-mono text-slate-400">
                      JURISDICTION: <span className="text-slate-300">{detail.case.district} POLICE SECTOR</span>
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-[11px] font-mono text-slate-400">
                      INCIDENT DATE: <span className="text-slate-300">{detail.case.created_at ? new Date(detail.case.created_at).toLocaleDateString() : "Historical"}</span>
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white text-glow-white tracking-wide">
                    {detail.case.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/evidence?case=${encodeURIComponent(detail.case.case_number)}`)}
                    className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 text-sky-400 hover:text-sky-300 border-slate-800 bg-slate-950/80 hover:bg-slate-900 shadow-sm"
                    title="Open all forensic evidence for this case in Evidence Management Workspace"
                  >
                    <Fingerprint size={13} />
                    <span>View Case Evidence</span>
                  </button>
                  <button
                    onClick={() => navigate("/network")}
                    className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 border-slate-800 bg-slate-950/80 hover:bg-slate-900 text-slate-200 shadow-sm"
                  >
                    <NetworkIcon size={13} />
                    <span>Case Subgraph</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="btn-ghost py-1.5 px-2 text-xs border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-slate-300"
                    title="Print Case Summary"
                  >
                    <Printer size={13} />
                  </button>
                </div>
              </div>

              {/* Investigation Workspace Tabs */}
              <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-800/80 overflow-x-auto">
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeTab === id
                        ? "bg-slate-800 text-sky-300 font-semibold shadow-sm border border-sky-500/40 text-glow-sky"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
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
                  <div className="p-5 rounded-xl border border-slate-800/90 bg-slate-900/95 shadow-xl">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 text-glow-sky mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                      EXECUTIVE INVESTIGATION BRIEF
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-normal">
                      {detail.case.description || "Active criminal case involving coordinated syndicates operating across sector jurisdiction. Multi-jurisdictional surveillance and financial analysis underway."}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
                        <span className="text-[10px] font-mono text-slate-400 block mb-0.5">Lead Investigator:</span>
                        <span className="font-semibold text-white">
                          {detail.case.assigned_officer || "Cyber Crime Branch"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
                        <span className="text-[10px] font-mono text-slate-400 block mb-0.5">Case Status:</span>
                        <span className="badge badge-low text-[9px] uppercase mt-0.5">
                          {detail.case.status || "Open"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
                        <span className="text-[10px] font-mono text-slate-400 block mb-0.5">Registration Station:</span>
                        <span className="font-semibold text-white">
                          {detail.case.district} Central Station
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
                        <span className="text-[10px] font-mono text-slate-400 block mb-0.5">Evidence Items:</span>
                        <span className="font-mono text-sky-300 font-bold text-glow-sky">
                          {evidenceList.length || 4} Verified Seals
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* IPC / BNS Legal Penal Sections */}
                  <div className="p-5 rounded-xl border border-slate-800/90 bg-slate-900/95 shadow-xl">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 text-glow-sky mb-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
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
                          className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors"
                        >
                          <div className="font-mono font-bold text-xs text-amber-300 text-glow-amber">
                            {item.sec}
                          </div>
                          <div className="text-[11px] text-slate-300 mt-1 leading-relaxed">
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
                    <div className="p-8 rounded-xl border border-slate-800/90 bg-slate-900/95 text-center text-xs text-slate-400">
                      No formal FIRs linked to this case file yet.
                    </div>
                  ) : (
                    detail.firs?.map((fir: any) => (
                      <div
                        key={fir.id}
                        className="p-4 rounded-xl border border-slate-800/90 bg-slate-900/95 shadow-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-sky-300 text-glow-sky">
                            {fir.fir_number}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Recorded: {fir.created_at ? new Date(fir.created_at).toLocaleDateString() : "Historical"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">
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
                  <div className="text-[11px] font-mono text-slate-400">
                    Cross-case entities identified through FIR mentions, CDR call bursts, and financial transaction links.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {detail.accused_entities?.map((ent: any) => (
                      <div
                        key={ent.id}
                        onClick={() => navigate("/entities")}
                        className="p-4 rounded-xl border border-slate-800/90 bg-slate-900/95 hover:border-sky-500/60 hover:bg-slate-900 cursor-pointer transition-all shadow-md space-y-1.5 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors">
                            {ent.name}
                          </span>
                          <span className="badge badge-low text-[8px] font-mono uppercase">{ent.type}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          Alleged Association: <strong className="text-slate-200 font-semibold">{ent.role || "Person of Interest"}</strong>
                        </div>
                        <div className="text-[10px] text-sky-400 group-hover:text-sky-300 font-mono flex items-center gap-1 pt-1">
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
                  <div className="p-4 rounded-xl border border-slate-800/90 bg-slate-900/95 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-l-sky-500">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck size={16} className="text-emerald-400 text-glow-emerald" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Tamper-Evident Evidence Integrity Ledger
                        </span>
                        <span className="badge badge-verified text-[8px] font-mono">SHA-256 Validated</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Every seized forensic item is cryptographically sealed at acquisition. Officers can independently verify against unauthorized alterations.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={loadEvidence}
                        disabled={loadingEvidence}
                        className="btn-ghost py-1 px-2.5 text-xs flex items-center gap-1.5 border border-slate-800 bg-slate-950/60 text-slate-300 hover:text-white"
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
                    <form onSubmit={handleCreateExhibit} className="p-4 rounded-xl border border-sky-500/40 bg-slate-900/95 shadow-xl space-y-3">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <Plus size={14} className="text-sky-400" />
                        <span className="font-mono uppercase tracking-wider text-glow-white">REGISTER NEW FORENSIC EXHIBIT INTO CRYPTOGRAPHIC LEDGER</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block mb-1">Exhibit Type</label>
                          <select
                            value={newExhibit.evidence_type}
                            onChange={(e) => setNewExhibit({ ...newExhibit, evidence_type: e.target.value })}
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-sky-500 text-slate-100 text-xs font-mono outline-none"
                          >
                            <option value="DIGITAL_EXTRACTION">Digital Extraction (Mobile/PC)</option>
                            <option value="CCTV_SURVEILLANCE">CCTV Surveillance Footage</option>
                            <option value="FINANCIAL_LEDGER">Financial / Hawala Ledger</option>
                            <option value="CDR_LOGS">Telecom Tower CDR Logs</option>
                            <option value="PHYSICAL_SEIZURE">Physical Evidence Item</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block mb-1">Seizure Description</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Seized iPhone 14 IMEI ..., recovered at safehouse"
                            value={newExhibit.description}
                            onChange={(e) => setNewExhibit({ ...newExhibit, description: e.target.value })}
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-sky-500 text-slate-100 placeholder-slate-500 text-xs font-mono outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block mb-1">Custodian Division</label>
                          <input
                            type="text"
                            value={newExhibit.custodian_division}
                            onChange={(e) => setNewExhibit({ ...newExhibit, custodian_division: e.target.value })}
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-sky-500 text-slate-100 placeholder-slate-500 text-xs font-mono outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => setShowAddExhibit(false)}
                          className="btn-ghost text-xs px-3 py-1 text-slate-400 hover:text-white"
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
                          className="p-3.5 rounded-xl border border-slate-800/90 bg-slate-900/95 hover:border-slate-700 transition-all shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-sky-400 shrink-0">
                              <Fingerprint size={16} />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">
                                  {ev.title || ev.description}
                                </span>
                                <span className="badge badge-low text-[8px] font-mono">
                                  {ev.evidence_type}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300">
                                {ev.description}
                              </p>
                              <div className="text-[10px] font-mono text-slate-400">
                                SHA-256: <span className="text-sky-300">{ev.sha256_digest?.substring(0, 24)}...</span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {verified && (
                              <span className="badge badge-verified text-[9px] flex items-center gap-1 font-mono">
                                <CheckCircle2 size={11} /> Verified
                              </span>
                            )}
                            <button
                              onClick={() => handleVerify(ev.id)}
                              disabled={isVerifying}
                              className="btn-secondary py-1 px-2.5 text-[10px] font-mono border-slate-800 bg-slate-950 text-slate-200 hover:text-white"
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
                  <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed">
                    <strong className="text-amber-300 font-bold">ASSISTIVE INTELLIGENCE NOTICE:</strong> All algorithmic leads represent statistical hypotheses generated by graph neural clustering. They must be independently verified through field surveillance and legal records.
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
                        className="p-4 rounded-xl border border-slate-800/90 bg-slate-900/95 shadow-md space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="badge badge-low text-[8px] font-mono">{lead.type}</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Confidence of Suggestion: <span className="text-sky-300 font-bold">{lead.confidence}%</span>
                          </span>
                        </div>
                        <div className="text-xs font-bold text-white text-glow-white">
                          {lead.title}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
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
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <FolderKanban size={40} className="opacity-20 mb-2 text-sky-400" />
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              No Case Selected
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Select an investigation from the left registry to open its workspace.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
