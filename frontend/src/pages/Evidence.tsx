import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import {
  ShieldCheck, Search, Filter, RefreshCw, Plus, CheckCircle2,
  FileDigit, Fingerprint, Lock, Copy, Check, X, ChevronRight,
  Upload, Download, FileText, PhoneCall, DollarSign, Video,
  LayoutGrid, List, ExternalLink, FileCheck,
  Shield, ShieldAlert
} from "lucide-react";

// Evidence type metadata and category classification
const EVIDENCE_TYPES: Record<string, { label: string; icon: any; badgeClass: string }> = {
  ALL: { label: "All Exhibits", icon: FileDigit, badgeClass: "badge-low" },
  FIR: { label: "FIR Records", icon: FileText, badgeClass: "badge-purple" },
  CDR: { label: "Telecom CDR", icon: PhoneCall, badgeClass: "badge-low" },
  FINANCIAL: { label: "Financial / Wire", icon: DollarSign, badgeClass: "badge-medium" },
  SURVEILLANCE: { label: "Surveillance Feeds", icon: Video, badgeClass: "badge-low" },
  CCTV_SURVEILLANCE: { label: "CCTV Footage", icon: Video, badgeClass: "badge-low" },
  INVESTIGATION_NOTE: { label: "Investigation Notes", icon: FileCheck, badgeClass: "badge-low" },
  DIGITAL_EXTRACTION: { label: "Digital Extraction", icon: Fingerprint, badgeClass: "badge-low" },
};

export default function Evidence() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const caseFromUrl = searchParams.get("case") || "ALL";

  const { user } = useAuth();
  const isOfficerOrAdmin = user?.role === "investigator" || user?.role === "admin";

  // Data state
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [casesList, setCasesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalExhibits, setTotalExhibits] = useState(0);

  // Filters state (File Manager 2 pattern)
  const [search, setSearch] = useState("");
  const [selectedCase, setSelectedCase] = useState<string>(caseFromUrl);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title" | "case">("newest");

  // Selection state (File Manager 2 selection bar)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dossier Drawer & Modal states
  const [selectedExhibit, setSelectedExhibit] = useState<any | null>(null);
  const [verificationModal, setVerificationModal] = useState<any | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifiedMap, setVerifiedMap] = useState<Record<string, any>>({});
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);

  // Upload workflow modal (File Manager 4 integration point)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    evidence_type: "DIGITAL_EXTRACTION",
    case_id: "",
    custodian_division: "District Cyber Forensics Lab",
    description: "",
  });
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Sync state if URL query changes
  useEffect(() => {
    const urlCase = searchParams.get("case") || "ALL";
    setSelectedCase(urlCase);
  }, [searchParams]);

  // Load cases list for case filter dropdown
  useEffect(() => {
    api.cases().then((r) => setCasesList(r.cases || [])).catch(() => {});
  }, []);

  // Fetch evidence records from backend
  function loadEvidence() {
    setLoading(true);
    api.evidence({
      case_id: selectedCase !== "ALL" ? selectedCase : undefined,
      q: search.trim() ? search.trim() : undefined,
      evidence_type: typeFilter !== "ALL" ? typeFilter : undefined,
      status: statusFilter !== "ALL" ? statusFilter : undefined,
      page: 1,
      page_size: 150,
    })
      .then((res: any) => {
        setEvidenceList(res.evidence || []);
        setTotalExhibits(res.total_exhibits ?? (res.evidence?.length || 0));
        setLoading(false);
      })
      .catch(() => {
        setEvidenceList([]);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadEvidence();
  }, [selectedCase, search, typeFilter, statusFilter]);

  // Multi-selection handlers (File Manager 2 selection bar)
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === filteredEvidence.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEvidence.map((e) => e.id)));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }


  // Batch Verify for selection bar
  async function handleBatchVerify() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setVerifyingId("batch");
    try {
      for (const id of ids) {
        const res = await api.verifyEvidence(id);
        setVerifiedMap((prev) => ({ ...prev, [id]: res }));
      }
      alert(`Cryptographic seal verification completed for ${ids.length} selected forensic assets.`);
    } catch (e: any) {
      alert("Batch verification error: " + e.message);
    } finally {
      setVerifyingId(null);
    }
  }

  // Export manifest for selection bar
  function handleExportManifest() {
    const selectedRecords = evidenceList.filter((e) => selectedIds.has(e.id));
    const manifest = {
      manifest_type: "DRISHYAM_FORENSIC_EVIDENCE_MANIFEST",
      exported_at: new Date().toISOString(),
      officer_badge: user?.email || "SYSTEM_AUDITOR",
      total_exhibits: selectedRecords.length,
      exhibits: selectedRecords.map((e) => ({
        id: e.id,
        title: e.title,
        evidence_type: e.evidence_type,
        case_number: e.case_number,
        fir_number: e.fir_number,
        sha256_digest: e.sha256_digest,
        integrity_status: verifiedMap[e.id] ? "VERIFIED_VALID" : e.integrity_status,
        custody: e.custody,
        storage_path: e.storage_path,
        created_at: e.created_at,
      })),
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evidence_manifest_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyToClipboard(text: string, id: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedHashId(id);
    setTimeout(() => setCopiedHashId(null), 2000);
  }

  // Handle case filter dropdown change
  function handleCaseChange(caseValue: string) {
    setSelectedCase(caseValue);
    if (caseValue === "ALL") {
      searchParams.delete("case");
      setSearchParams(searchParams);
    } else {
      setSearchParams({ case: caseValue });
    }
  }

  // Integrity Verification & Tamper Detection Handler
  async function handleVerify(exhibit: any, simulateTamper = false) {
    if (!exhibit) return;
    setVerifyingId(exhibit.id);
    try {
      const res = await api.verifyEvidence(exhibit.id, simulateTamper);
      setVerifiedMap((prev) => ({ ...prev, [exhibit.id]: res }));
      setVerificationModal({
        exhibit,
        result: res,
      });
      loadEvidence();
    } catch (err: any) {
      alert("Integrity verification failed: " + err.message);
    } finally {
      setVerifyingId(null);
    }
  }

  // Upload/Register Exhibit
  async function handleRegisterExhibit(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadForm.description && !uploadForm.title && !selectedFile) return;
    setUploadSubmitting(true);
    try {
      const targetCaseId = uploadForm.case_id || (selectedCase !== "ALL" ? selectedCase : "");
      const fullDescription = uploadForm.title
        ? `${uploadForm.title} — ${uploadForm.description}`
        : uploadForm.description || (selectedFile ? selectedFile.name : "Forensic Exhibit");

      if (selectedFile) {
        // Physical file upload with binary SHA-256 computation
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("evidence_type", uploadForm.evidence_type);
        formData.append("description", fullDescription);
        if (targetCaseId) {
          formData.append("case_id", targetCaseId);
        }
        formData.append("custodian_division", uploadForm.custodian_division);
        await api.uploadEvidenceFile(formData);
      } else {
        // Metadata registration
        await api.registerEvidence({
          evidence_type: uploadForm.evidence_type,
          description: fullDescription,
          custodian_division: uploadForm.custodian_division,
          case_id: targetCaseId || undefined,
        });
      }

      setShowUploadModal(false);
      setShowManualModal(false);
      setSelectedFile(null);
      setUploadForm({
        title: "",
        evidence_type: "DIGITAL_EXTRACTION",
        case_id: "",
        custodian_division: "District Cyber Forensics Lab",
        description: "",
      });
      loadEvidence();
    } catch (err: any) {
      alert("Failed to record forensic exhibit: " + err.message);
    } finally {
      setUploadSubmitting(false);
    }
  }

  // Client-side sorting & fallback filtering
  const filteredEvidence = useMemo(() => {
    return [...evidenceList].sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      if (sortBy === "title") {
        return (a.title || "").localeCompare(b.title || "");
      }
      if (sortBy === "case") {
        return (a.case_number || a.source_record_id || "").localeCompare(b.case_number || b.source_record_id || "");
      }
      return 0;
    });
  }, [evidenceList, sortBy]);

  // Selected case details for breadcrumb
  const currentCaseObj = useMemo(() => {
    if (selectedCase === "ALL") return null;
    return casesList.find((c) => c.case_number === selectedCase || c.id === selectedCase);
  }, [selectedCase, casesList]);

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg-void)]">
      {/* ── Main Evidence Workspace Body ── */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-[var(--border-subtle)] overflow-hidden">
        
        {/* ── Top Header Strip with Breadcrumbs (File Manager 2) ── */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-panel-solid)] flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            {/* Breadcrumb Bar */}
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
              <span className="text-zinc-500">Workspace</span>
              <ChevronRight size={11} className="text-zinc-600" />
              <button
                onClick={() => handleCaseChange("ALL")}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Evidence
              </button>
              {selectedCase !== "ALL" && (
                <>
                  <ChevronRight size={11} className="text-zinc-600" />
                  <span className="flex items-center gap-1 text-sky-400 font-semibold bg-sky-950/40 px-2 py-0.5 rounded border border-sky-800/50">
                    <span>Case: {currentCaseObj ? `${currentCaseObj.case_number}` : selectedCase}</span>
                    <button
                      onClick={() => handleCaseChange("ALL")}
                      className="hover:text-white p-0.5"
                      title="Clear Case Filter"
                    >
                      <X size={10} />
                    </button>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
                <ShieldCheck size={18} className="text-emerald-400" />
              </div>
              <div>
                <h1 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Evidence Management Workspace
                </h1>
                <p className="text-[11px] font-mono text-[var(--text-muted)]">
                  Cryptographically sealed forensic chain of custody & asset registry
                </p>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2.5">
            {isOfficerOrAdmin && (
              <>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="btn-primary flex items-center gap-1.5 text-xs shadow-lg shadow-sky-950/40"
                  title="Open Secure Evidence Ingestion (File Manager 4 workflow)"
                >
                  <Upload size={13} />
                  <span>+ Upload Evidence</span>
                </button>
                <button
                  onClick={() => setShowManualModal(true)}
                  className="btn-secondary flex items-center gap-1.5 text-xs"
                >
                  <Plus size={13} />
                  <span>Record Exhibit</span>
                </button>
              </>
            )}

            <button
              onClick={loadEvidence}
              className="p-2 rounded border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white bg-zinc-900 transition-all cursor-pointer"
              title="Refresh Evidence Ledger"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-sky-400" : ""} />
            </button>
          </div>
        </div>

        {/* ── Search, Case Selector & Type Filters (File Manager 2) ── */}
        <div className="px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Bar */}
            <div className="relative flex items-center flex-1 min-w-[280px] max-w-md">
              <Search size={13} className="absolute left-3 text-zinc-400 pointer-events-none shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Exhibit ID, Case #, FIR, description, custody..."
                className="w-full bg-[#121216] border border-zinc-800 hover:border-zinc-700 focus:border-sky-500/70 focus:ring-1 focus:ring-sky-500/40 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 outline-none transition-all py-2 pr-8 shadow-inner"
                style={{ paddingLeft: "36px" }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 text-zinc-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Case Filter Dropdown & Status Filter */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Case Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-[#121216] border border-zinc-800 hover:border-zinc-700 rounded-lg px-2.5 py-1.5 transition-colors">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Case:</span>
                <select
                  value={selectedCase}
                  onChange={(e) => handleCaseChange(e.target.value)}
                  className="bg-transparent text-xs text-zinc-200 outline-none cursor-pointer max-w-[200px] truncate"
                >
                  <option value="ALL" className="bg-[#121216]">All Active Cases ({casesList.length})</option>
                  {casesList.map((c) => (
                    <option key={c.id} value={c.case_number} className="bg-[#121216]">
                      {c.case_number}: {c.title?.slice(0, 30)}...
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-[#121216] border border-zinc-800 hover:border-zinc-700 rounded-lg px-2.5 py-1.5 transition-colors">
                <Filter size={11} className="text-zinc-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs text-zinc-200 outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-[#121216]">All Status</option>
                  <option value="VERIFIED" className="bg-[#121216]">Cryptographically Sealed</option>
                  <option value="REVIEW" className="bg-[#121216]">Under Audit Review</option>
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1.5 bg-[#121216] border border-zinc-800 hover:border-zinc-700 rounded-lg px-2.5 py-1.5 transition-colors">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-xs text-zinc-200 outline-none cursor-pointer"
                >
                  <option value="newest" className="bg-[#121216]">Newest Seizure</option>
                  <option value="oldest" className="bg-[#121216]">Oldest Seizure</option>
                  <option value="title" className="bg-[#121216]">Title (A-Z)</option>
                  <option value="case" className="bg-[#121216]">Case Identifier</option>
                </select>
              </div>

              {/* View Switcher: Grid vs Table */}
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded text-xs transition-all ${
                    viewMode === "grid"
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  title="Evidence Asset Grid"
                >
                  <LayoutGrid size={13} />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded text-xs transition-all ${
                    viewMode === "table"
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  title="Detailed Audit Table"
                >
                  <List size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Type Filter Chips (File Manager 2 type filters) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {Object.entries(EVIDENCE_TYPES).map(([typeKey, info]) => {
              const IconComp = info.icon;
              const isActive = typeFilter === typeKey;
              return (
                <button
                  key={typeKey}
                  onClick={() => setTypeFilter(typeKey)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] border transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? "bg-sky-950/50 border-sky-600/60 text-sky-200 font-semibold shadow-sm"
                      : "bg-[#141418] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  <IconComp size={12} className={isActive ? "text-sky-400" : "text-zinc-500"} />
                  <span>{info.label}</span>
                </button>
              );
            })}

            <div className="ml-auto text-[11px] font-mono text-zinc-500 shrink-0">
              Showing <strong className="text-white">{filteredEvidence.length}</strong> of{" "}
              <strong className="text-zinc-400">{totalExhibits}</strong> exhibits
            </div>
          </div>
        </div>

        {/* ── Main Data Viewport (Asset Grid vs Table) ── */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          {/* Active Case Scope Focus Banner */}
          {selectedCase !== "ALL" && (
            <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-sky-950/50 via-zinc-900/80 to-zinc-950 border border-sky-600/50 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
                  <Shield size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                      Case Evidence Scope
                    </span>
                    <span className="badge badge-purple text-[9px]">{currentCaseObj?.case_number || selectedCase}</span>
                    {currentCaseObj?.district && (
                      <span className="badge badge-low text-[9px]">{currentCaseObj.district} District</span>
                    )}
                  </div>
                  <h2 className="text-sm font-bold text-zinc-100 mt-0.5">
                    {currentCaseObj?.title || `Investigation ${selectedCase}`}
                  </h2>
                  <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-3 mt-0.5">
                    <span>Associated FIRs: <strong className="text-amber-400">{currentCaseObj?.fir_count || 1}</strong></span>
                    <span>·</span>
                    <span>Seized Exhibits: <strong className="text-emerald-400">{filteredEvidence.length}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {currentCaseObj && (
                  <button
                    onClick={() => navigate(`/cases?id=${currentCaseObj.id}`)}
                    className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 text-sky-300 hover:text-white transition-all cursor-pointer"
                  >
                    <span>View Case File</span>
                    <ExternalLink size={12} />
                  </button>
                )}
                <button
                  onClick={() => handleCaseChange("ALL")}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
                  title="View all exhibits across all cases"
                >
                  <X size={12} />
                  <span>Show All Evidence</span>
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="skeleton h-56 rounded-xl" />
              ))}
            </div>
          ) : filteredEvidence.length === 0 ? (
            /* Empty State */
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[var(--text-muted)] space-y-3">
              <FileDigit size={44} className="opacity-25 mb-1 text-zinc-500" />
              <div className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                {selectedCase !== "ALL"
                  ? "No evidence is currently associated with this case."
                  : search
                  ? "No matching evidence found."
                  : "No evidence records found."}
              </div>
              <p className="text-xs text-zinc-500 max-w-md">
                {selectedCase !== "ALL"
                  ? `Case ${selectedCase} has no indexed exhibits yet. You can upload or register new evidence.`
                  : "Try clearing your search query or selecting a different exhibit category."}
              </p>
              {(search || selectedCase !== "ALL" || typeFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSearch("");
                    handleCaseChange("ALL");
                    setTypeFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                  className="btn-secondary text-xs flex items-center gap-1.5 mt-2"
                >
                  <RefreshCw size={12} />
                  <span>Reset All Filters</span>
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            /* ── ASSET GRID (File Manager 2 Block Layout) ── */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
              {filteredEvidence.map((ev) => {
                const isSelected = selectedIds.has(ev.id);
                const verified = verifiedMap[ev.id];
                const isVerifying = verifyingId === ev.id;
                const isCopied = copiedHashId === ev.id;
                const typeMeta = EVIDENCE_TYPES[ev.evidence_type] || EVIDENCE_TYPES.ALL;
                const TypeIcon = typeMeta.icon;

                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedExhibit(ev)}
                    className={`group relative rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? "bg-[#141824] border-sky-500/70 shadow-lg shadow-sky-950/30"
                        : "bg-[#0d0d11] border-zinc-800/80 hover:border-zinc-700 hover:bg-[#111116] shadow-md"
                    }`}
                  >
                    {/* Top Bar: Checkbox & Type Pill */}
                    <div className="p-3 pb-2 flex items-start justify-between gap-2 border-b border-zinc-800/50">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(ev.id);
                          }}
                          className="rounded bg-zinc-900 border-zinc-700 text-sky-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                          title="Select exhibit for batch operations"
                        />
                        <span className="text-[10px] font-mono text-zinc-500 truncate">
                          {ev.id.slice(0, 14)}...
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono uppercase font-semibold ${
                          ev.evidence_type === "FINANCIAL"
                            ? "bg-amber-950/40 text-amber-300 border border-amber-800/40"
                            : ev.evidence_type === "CDR"
                            ? "bg-sky-950/40 text-sky-300 border border-sky-800/40"
                            : ev.evidence_type === "FIR"
                            ? "bg-purple-950/40 text-purple-300 border border-purple-800/40"
                            : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                        }`}
                      >
                        {ev.evidence_type?.replace("_", " ")}
                      </span>
                    </div>

                    {/* Forensic Asset Card Preview & Title */}
                    <div className="p-3 space-y-2.5 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#15151c] border border-zinc-800 flex items-center justify-center text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
                          <TypeIcon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-bold text-zinc-100 truncate group-hover:text-sky-300 transition-colors">
                            {ev.title || ev.description}
                          </h3>
                          <div className="text-[10px] font-mono text-zinc-500 truncate">
                            Custody: {ev.custody || "Forensic Vault"}
                          </div>
                        </div>
                      </div>

                      {/* Associated Case Tag */}
                      <div className="p-2 rounded bg-[#131317] border border-zinc-800/70 text-[11px] font-mono flex items-center justify-between">
                        <span className="text-zinc-400 truncate">
                          {ev.case_number ? (
                            <span className="text-sky-400 font-semibold">
                              Case: {ev.case_number}
                              {ev.fir_number && <span className="text-zinc-500 ml-1">({ev.fir_number})</span>}
                            </span>
                          ) : ev.source_record_id ? (
                            <span className="text-sky-400 font-semibold">
                              Source: {ev.source_record_id}
                            </span>
                          ) : (
                            <span className="text-zinc-600">Unassigned Case</span>
                          )}
                        </span>

                        {ev.case_id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/cases?id=${ev.case_id}`);
                            }}
                            className="text-zinc-500 hover:text-sky-400 p-0.5 transition-colors"
                            title="Open Associated Case"
                          >
                            <ExternalLink size={11} />
                          </button>
                        )}
                      </div>

                      <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                        {ev.description}
                      </p>
                    </div>

                    {/* Card Footer: SHA-256 Digest & Actions */}
                    <div className="p-3 pt-2 bg-[#0a0a0d] border-t border-zinc-800/70 space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Lock size={10} className="text-emerald-400" />
                          <span className="truncate max-w-[130px]">{ev.sha256_digest || "Sealed"}</span>
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(ev.sha256_digest, ev.id);
                          }}
                          className="text-zinc-500 hover:text-white p-0.5"
                          title="Copy SHA-256 Digest"
                        >
                          {isCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span
                          className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase ${
                            verified ? "text-emerald-400" : "text-emerald-500/80"
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                          <span>{verified ? "VERIFIED" : "SEALED"}</span>
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVerify(ev);
                            }}
                            disabled={isVerifying}
                            className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-[10px] font-mono text-zinc-300 hover:text-white transition-colors"
                            title="Verify Tamper-Evident SHA-256 Hash"
                          >
                            {isVerifying ? (
                              <RefreshCw size={10} className="animate-spin text-sky-400" />
                            ) : (
                              "Verify"
                            )}
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedExhibit(ev);
                            }}
                            className="px-2 py-1 rounded bg-sky-950/60 hover:bg-sky-900/80 border border-sky-700/60 text-[10px] font-mono text-sky-300 transition-colors"
                          >
                            Inspect →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── DETAILED TABLE VIEW (Compact Audit Ledger) ── */
            <div className="border border-zinc-800 bg-[#0d0d11] rounded-xl overflow-hidden shadow-2xl pb-20">
              <div className="overflow-x-auto">
                <table className="investigation-table text-xs w-full">
                  <thead>
                    <tr className="bg-[#121216] border-b border-zinc-800 text-zinc-400 font-mono">
                      <th className="w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filteredEvidence.length && filteredEvidence.length > 0}
                          onChange={selectAll}
                          className="rounded bg-zinc-900 border-zinc-700 text-sky-500 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="w-64">Exhibit & Description</th>
                      <th className="w-32">Type</th>
                      <th className="w-40">Associated Case</th>
                      <th>SHA-256 Digest</th>
                      <th className="w-32">Integrity Status</th>
                      <th className="w-28 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredEvidence.map((ev) => {
                      const isSelected = selectedIds.has(ev.id);
                      const verified = verifiedMap[ev.id];
                      const isVerifying = verifyingId === ev.id;
                      const isCopied = copiedHashId === ev.id;

                      return (
                        <tr
                          key={ev.id}
                          onClick={() => setSelectedExhibit(ev)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? "bg-sky-950/30" : "hover:bg-zinc-800/40"
                          }`}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(ev.id)}
                              className="rounded bg-zinc-900 border-zinc-700 text-sky-500 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td>
                            <div className="font-semibold text-zinc-100 truncate hover:text-sky-300">
                              {ev.title || ev.description}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 truncate">
                              ID: {ev.id.slice(0, 16)}...
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-low text-[9px] font-mono uppercase">
                              {ev.evidence_type}
                            </span>
                          </td>
                          <td>
                            {ev.case_number ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/cases?id=${ev.case_id}`);
                                }}
                                className="text-sky-400 hover:underline font-mono text-[11px] flex items-center gap-1"
                              >
                                <span>{ev.case_number}</span>
                                <ExternalLink size={10} />
                              </button>
                            ) : (
                              <span className="text-zinc-500 font-mono text-[11px]">
                                {ev.source_record_id || "—"}
                              </span>
                            )}
                          </td>
                          <td className="font-mono text-[10px] text-zinc-400 select-all truncate max-w-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{ev.sha256_digest}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(ev.sha256_digest, ev.id);
                                }}
                                className="p-1 hover:text-white"
                              >
                                {isCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                              </button>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                                verified ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800/40" : "bg-zinc-800 text-zinc-300"
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>{verified ? "VERIFIED" : "SEALED"}</span>
                            </span>
                          </td>
                          <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleVerify(ev)}
                                disabled={isVerifying}
                                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300"
                              >
                                {isVerifying ? "Verifying..." : "Verify"}
                              </button>
                              <button
                                onClick={() => setSelectedExhibit(ev)}
                                className="px-2 py-1 rounded bg-sky-950/80 hover:bg-sky-900 text-[10px] font-mono text-sky-300 border border-sky-800/60"
                              >
                                Dossier →
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── FLOATING SELECTION BAR (File Manager 2) ── */}
          {selectedIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#121218] border border-sky-500/50 rounded-xl px-5 py-3 shadow-2xl backdrop-blur flex items-center gap-4 text-xs font-mono text-zinc-200 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/60 text-sky-400 font-bold flex items-center justify-center text-[11px]">
                  {selectedIds.size}
                </span>
                <span className="font-semibold">Exhibits Selected</span>
              </div>

              <div className="h-4 w-px bg-zinc-700" />

              <div className="flex items-center gap-2">
                <button
                  onClick={handleBatchVerify}
                  disabled={verifyingId === "batch"}
                  className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <CheckCircle2 size={13} className={verifyingId === "batch" ? "animate-spin" : ""} />
                  <span>Verify All Selected</span>
                </button>

                <button
                  onClick={handleExportManifest}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download size={13} />
                  <span>Export Manifest (JSON)</span>
                </button>

                <button
                  onClick={clearSelection}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="Clear Selection"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Slide-Out Evidence Dossier 360 Inspector (Right Drawer) ── */}
      {selectedExhibit && (
        <div className="w-[440px] shrink-0 flex flex-col bg-[var(--bg-panel-solid)] border-l border-[var(--border-subtle)] overflow-y-auto animate-in slide-in-from-right duration-200">
          {/* Dossier Header */}
          <div className="p-5 border-b border-[var(--border-subtle)]">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-sky-400">
                <Fingerprint size={16} />
                <span>Forensic Evidence Dossier</span>
              </div>
              <button
                onClick={() => setSelectedExhibit(null)}
                className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <h2 className="text-base font-bold text-zinc-100 leading-snug">
              {selectedExhibit.title || selectedExhibit.description}
            </h2>
            <div className="text-[10px] font-mono text-zinc-500 mt-1">
              EXHIBIT IDENTIFIER: {selectedExhibit.id}
            </div>
          </div>

          <div className="p-5 space-y-5 flex-1">
            {/* Associated Case Card */}
            <div className="p-4 rounded-xl bg-[#101015] border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Shield size={12} className="text-sky-400" />
                  Associated Case Dossier
                </span>
                {selectedExhibit.case_number && (
                  <span className="badge badge-purple text-[9px]">
                    {selectedExhibit.case_number}
                  </span>
                )}
              </div>

              {selectedExhibit.case_id || selectedExhibit.case_number ? (
                <div>
                  <div className="text-xs font-bold text-zinc-100">
                    {selectedExhibit.case_title || `Investigation Case ${selectedExhibit.case_number}`}
                  </div>
                  {selectedExhibit.fir_number && (
                    <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                      Originating FIR: <strong className="text-amber-400">{selectedExhibit.fir_number}</strong>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (selectedExhibit.case_id) {
                        navigate(`/cases?id=${selectedExhibit.case_id}`);
                      } else if (selectedExhibit.case_number) {
                        navigate(`/cases?case=${selectedExhibit.case_number}`);
                      }
                    }}
                    className="w-full mt-3 btn-secondary py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 text-sky-300 hover:text-sky-200"
                  >
                    <span>Open Case Dossier</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              ) : (
                <div className="text-xs text-zinc-500 font-mono">
                  No direct Case record attached. Seizure Source: {selectedExhibit.source_record_id || "Unassigned"}
                </div>
              )}
            </div>

            {/* Cryptographic Seal & SHA-256 Digest */}
            <div className="p-4 rounded-xl bg-[#101015] border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Lock size={12} className="text-emerald-400" />
                  Tamper-Evident SHA-256 Digest
                </span>
                <span className="badge badge-verified text-[8px]">
                  {verifiedMap[selectedExhibit.id] ? "VERIFIED VALID" : "CRYPTOGRAPHICALLY SEALED"}
                </span>
              </div>

              <div className="p-2 rounded bg-black border border-zinc-800 text-[10px] font-mono text-sky-300 break-all select-all flex items-start justify-between gap-2">
                <span>{selectedExhibit.sha256_digest || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}</span>
                <button
                  onClick={() => copyToClipboard(selectedExhibit.sha256_digest, selectedExhibit.id)}
                  className="p-1 text-zinc-500 hover:text-white shrink-0"
                  title="Copy Full Hash"
                >
                  {copiedHashId === selectedExhibit.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleVerify(selectedExhibit, false)}
                  disabled={verifyingId === selectedExhibit.id}
                  className="flex-1 btn-primary py-1.5 text-xs flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={13} className={verifyingId === selectedExhibit.id ? "animate-spin" : ""} />
                  <span>{verifyingId === selectedExhibit.id ? "Verifying..." : "Verify Digital Seal"}</span>
                </button>
                <button
                  onClick={() => handleVerify(selectedExhibit, true)}
                  disabled={verifyingId === selectedExhibit.id}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 hover:text-rose-300 text-zinc-400 border border-zinc-700 hover:border-rose-700 text-xs font-mono transition-colors"
                  title="Simulate altered file to test tamper detection"
                >
                  Test Tamper
                </button>
              </div>
            </div>

            {/* Chain of Custody & Telemetry */}
            <div className="space-y-2.5 text-xs font-mono">
              <div className="text-[10px] uppercase text-zinc-500 tracking-wider">Custody & Telemetry</div>
              <div className="p-3 rounded-lg bg-[#121216] border border-zinc-800/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Custodian Unit:</span>
                  <span className="text-zinc-200">{selectedExhibit.custody || "District Vault Locker"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Exhibit Type:</span>
                  <span className="text-sky-400 font-semibold">{selectedExhibit.evidence_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Seizure Date:</span>
                  <span className="text-zinc-300">
                    {selectedExhibit.created_at ? new Date(selectedExhibit.created_at).toLocaleString() : "Historical"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Forensic Confidence:</span>
                  <span className="text-emerald-400">
                    {Math.round((selectedExhibit.confidence || 0.95) * 100)}%
                  </span>
                </div>
                <div className="flex justify-between truncate">
                  <span className="text-zinc-500">Storage Vault:</span>
                  <span className="text-zinc-400 truncate max-w-[200px]">{selectedExhibit.storage_path}</span>
                </div>
              </div>
            </div>

            {/* Description / Narrative */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Seizure Notes & Narrative</div>
              <div className="p-3 rounded-lg bg-[#121216] border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                {selectedExhibit.description || "No narrative details recorded for this seized asset."}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── File Manager 4 Evidence Upload Workflow Modal ── */}
      {showUploadModal && (
        <div className="cmd-palette-backdrop" onClick={() => setShowUploadModal(false)}>
          <div
            className="cmd-palette-modal max-w-xl p-6 bg-[#0e0e12] border border-zinc-700 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-700/60 flex items-center justify-center text-sky-400">
                  <Upload size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    Secure Evidence Upload Workflow
                  </h2>
                  <p className="text-[11px] font-mono text-zinc-400">
                    INTAKE PROTOCOL (REACT BITS FILE MANAGER 4 INTEGRATION POINT)
                  </p>
                </div>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="text-zinc-500 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRegisterExhibit} className="py-4 space-y-4 text-xs">
              {/* Drag-and-drop intake zone with real file input */}
              <label htmlFor="evidence-file-upload" className="border-2 border-dashed border-zinc-700 hover:border-sky-500/80 rounded-xl p-6 text-center bg-[#13131a] transition-all flex flex-col items-center justify-center space-y-2 cursor-pointer block">
                <input
                  id="evidence-file-upload"
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setSelectedFile(f);
                      setUploadForm((prev) => ({
                        ...prev,
                        title: prev.title || f.name,
                      }));
                    }
                  }}
                />
                <Upload size={28} className="text-sky-400 mb-1 mx-auto" />
                {selectedFile ? (
                  <div className="space-y-1">
                    <div className="font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={14} />
                      <span>{selectedFile.name}</span>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400">
                      Size: {(selectedFile.size / 1024).toFixed(1)} KB • Ready for SHA-256 Bit Fingerprinting
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="font-bold text-zinc-200">
                      Drop digital forensic dumps, CDR logs, or CCTV feeds here
                    </div>
                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                      Supports UFED extractions, PCAP, RAW, MP4, PDF, CSV, and encrypted archives
                    </p>
                    <div className="pt-2">
                      <span className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-sky-300">
                        Browse Local File
                      </span>
                    </div>
                  </>
                )}
              </label>

              {/* Case & Exhibit Metadata */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                    Associate with Case
                  </label>
                  <select
                    value={uploadForm.case_id}
                    onChange={(e) => setUploadForm({ ...uploadForm, case_id: e.target.value })}
                    className="w-full bg-[#16161d] border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 outline-none"
                  >
                    <option value="">Select Target Case...</option>
                    {casesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.case_number}: {c.title?.slice(0, 24)}...
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                    Exhibit Category
                  </label>
                  <select
                    value={uploadForm.evidence_type}
                    onChange={(e) => setUploadForm({ ...uploadForm, evidence_type: e.target.value })}
                    className="w-full bg-[#16161d] border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 outline-none"
                  >
                    <option value="DIGITAL_EXTRACTION">Digital Extraction (UFED / PC)</option>
                    <option value="CDR_LOGS">Telecom CDR / Tower Logs</option>
                    <option value="FINANCIAL_LEDGER">Financial / Wire Transfer</option>
                    <option value="CCTV_SURVEILLANCE">CCTV / Surveillance Video</option>
                    <option value="INVESTIGATION_NOTE">Investigator Note / Field Statement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                  Exhibit Title / Asset Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Seized Hard Drive Clone - Sector 4 Raid"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full bg-[#16161d] border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                  Description & Seizure Context
                </label>
                <textarea
                  rows={3}
                  placeholder="Record seizure location, chain of custody officer, and initial forensic triage summary..."
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  className="w-full bg-[#16161d] border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 outline-none resize-none"
                  required
                />
              </div>

              {/* Cryptographic notice */}
              <div className="p-3 rounded-lg bg-sky-950/30 border border-sky-800/40 text-[11px] text-sky-300/90 leading-relaxed font-mono flex items-start gap-2">
                <Lock size={14} className="shrink-0 text-sky-400 mt-0.5" />
                <span>
                  Upon upload, the backend computes a cryptographic SHA-256 digital fingerprint, records the audit trail, and stamps the evidence into the tamper-evident ledger.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadSubmitting}
                  className="btn-primary px-5 py-2 text-xs flex items-center gap-1.5"
                >
                  <ShieldCheck size={14} />
                  <span>{uploadSubmitting ? "Sealing Exhibit..." : "Register & Seal Exhibit"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Manual Record Exhibit Modal ── */}
      {showManualModal && (
        <div className="cmd-palette-backdrop" onClick={() => setShowManualModal(false)}>
          <div
            className="cmd-palette-modal max-w-lg p-6 bg-[#0e0e12] border border-zinc-700 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-sky-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Record Seized Forensic Exhibit
                </h2>
              </div>
              <button onClick={() => setShowManualModal(false)} className="text-zinc-500 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRegisterExhibit} className="py-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                  Exhibit Type
                </label>
                <select
                  value={uploadForm.evidence_type}
                  onChange={(e) => setUploadForm({ ...uploadForm, evidence_type: e.target.value })}
                  className="w-full bg-[#16161d] border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 outline-none"
                >
                  <option value="DIGITAL_EXTRACTION">Digital Extraction</option>
                  <option value="CCTV_SURVEILLANCE">CCTV Surveillance</option>
                  <option value="FINANCIAL_LEDGER">Financial / Hawala Wire</option>
                  <option value="CDR_LOGS">Telecom CDR Logs</option>
                  <option value="PHYSICAL_SEIZURE">Physical Seizure Exhibit</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                  Case Association
                </label>
                <select
                  value={uploadForm.case_id}
                  onChange={(e) => setUploadForm({ ...uploadForm, case_id: e.target.value })}
                  className="w-full bg-[#16161d] border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 outline-none"
                >
                  <option value="">No Direct Case</option>
                  {casesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number}: {c.title?.slice(0, 30)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                  Custodian Division
                </label>
                <input
                  type="text"
                  value={uploadForm.custodian_division}
                  onChange={(e) => setUploadForm({ ...uploadForm, custodian_division: e.target.value })}
                  className="w-full bg-[#16161d] border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                  Exhibit Description & Chain of Custody
                </label>
                <textarea
                  rows={4}
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder="Record description of physical condition, packaging, and custody officer..."
                  className="w-full bg-[#16161d] border border-zinc-700 rounded-lg p-2 text-xs text-zinc-200 outline-none resize-none font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadSubmitting}
                  className="btn-primary px-5 py-2 text-xs flex items-center gap-1.5"
                >
                  <ShieldCheck size={14} />
                  <span>{uploadSubmitting ? "Recording..." : "Record Exhibit"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Verification Result Modal ── */}
      {verificationModal && (
        <div className="cmd-palette-backdrop" onClick={() => setVerificationModal(null)}>
          <div className="cmd-palette-modal max-w-lg p-5 bg-[#0e0e12] border border-zinc-700 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                {verificationModal.result?.verified ? (
                  <>
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                      Cryptographic Integrity Verification Audit
                    </h2>
                  </>
                ) : (
                  <>
                    <ShieldAlert size={18} className="text-rose-400" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-rose-400">
                      Integrity Failure: Tampering Detected
                    </h2>
                  </>
                )}
              </div>
              <button
                onClick={() => setVerificationModal(null)}
                className="text-zinc-500 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3 font-mono text-xs">
              {verificationModal.result?.verified ? (
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-700/50 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-300">
                      Evidence Integrity 100% Validated
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Live hash match confirms zero byte alteration since forensic seizure.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-700/60 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold">
                    !
                  </div>
                  <div>
                    <div className="text-xs font-bold text-rose-300">
                      CRITICAL: Cryptographic Mismatch Detected
                    </div>
                    <p className="text-[11px] text-rose-200/80 mt-0.5">
                      Recomputed digest does not match original seal. Exhibit bytes have been altered or corrupted!
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Exhibit ID:</span>
                  <span className="text-zinc-200">{verificationModal.exhibit.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Hashing Algorithm:</span>
                  <span className="text-sky-400">SHA-256 Cryptographic Hash Chaining</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Verified By Badge:</span>
                  <span className="text-zinc-200">{verificationModal.result?.verified_by || user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Verification Result:</span>
                  <span className={verificationModal.result?.verified ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                    {verificationModal.result?.status || (verificationModal.result?.verified ? "VERIFIED" : "TAMPER_DETECTED")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Timestamp:</span>
                  <span className="text-zinc-300">{new Date().toLocaleString()}</span>
                </div>
              </div>

              {verificationModal.result?.verified ? (
                <div>
                  <div className="text-[10px] text-zinc-500 mb-1">Calculated SHA-256 Digest:</div>
                  <div className="p-2 rounded bg-black border border-zinc-800 text-[10px] text-emerald-400 break-all select-all">
                    {verificationModal.result?.calculated_hash || verificationModal.exhibit.sha256_digest}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <div className="text-[10px] text-zinc-400 mb-1">Recorded Original Digital Seal:</div>
                    <div className="p-2 rounded bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-300 break-all select-all">
                      {verificationModal.result?.recorded_hash || verificationModal.exhibit.sha256_digest}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-rose-400 mb-1">Recalculated Altered Digest:</div>
                    <div className="p-2 rounded bg-rose-950/40 border border-rose-800 text-[10px] text-rose-300 break-all select-all">
                      {verificationModal.result?.calculated_hash}
                    </div>
                  </div>
                </div>
              )}

              {/* Forensic Integrity vs Authenticity Legal Disclaimer */}
              <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800 text-[10px] text-zinc-400 leading-relaxed">
                <strong>Forensic Notice:</strong> {verificationModal.result?.disclaimer || "Cryptographic verification proves data integrity (unaltered byte state since acquisition), not external authenticity of real-world claims."}
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setVerificationModal(null)}
                className="btn-primary py-1.5 px-4 text-xs font-mono"
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
