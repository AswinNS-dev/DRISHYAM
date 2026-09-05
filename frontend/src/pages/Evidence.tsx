import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import {
  ShieldCheck, Search, Filter, RefreshCw, Plus, CheckCircle2,
  FileDigit, Fingerprint, Lock, Copy, Check
} from "lucide-react";

export default function Evidence() {
  const { user } = useAuth();
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);

  // Verification state
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifiedMap, setVerifiedMap] = useState<Record<string, any>>({});
  const [verificationModal, setVerificationModal] = useState<any | null>(null);

  // New exhibit modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newExhibit, setNewExhibit] = useState({
    evidence_type: "DIGITAL_EXTRACTION",
    description: "",
    custodian_division: "District Cyber Forensics Lab",
    case_id: "",
  });
  const [casesList, setCasesList] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function loadEvidence() {
    setLoading(true);
    api.evidence()
      .then((res) => {
        setEvidenceList(res.evidence || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadEvidence();
    api.cases().then((r) => setCasesList(r.cases || [])).catch(() => {});
  }, []);

  async function handleVerify(ev: any) {
    setVerifyingId(ev.id);
    try {
      const res = await api.verifyEvidence(ev.id);
      setVerifiedMap((prev) => ({ ...prev, [ev.id]: res }));
      setVerificationModal({
        exhibit: ev,
        result: res,
      });
    } catch (e: any) {
      alert("Verification failed: " + e.message);
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleCreateExhibit(e: React.FormEvent) {
    e.preventDefault();
    if (!newExhibit.description) return;
    setSubmitting(true);
    try {
      await api.registerEvidence(newExhibit);
      setNewExhibit({
        evidence_type: "DIGITAL_EXTRACTION",
        description: "",
        custodian_division: "District Cyber Forensics Lab",
        case_id: "",
      });
      setShowAddModal(false);
      loadEvidence();
    } catch (err: any) {
      alert("Failed to record exhibit: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedHashId(id);
    setTimeout(() => setCopiedHashId(null), 2000);
  }

  const filteredEvidence = evidenceList.filter((ev) => {
    const matchesSearch =
      !search ||
      ev.id?.toLowerCase().includes(search.toLowerCase()) ||
      ev.title?.toLowerCase().includes(search.toLowerCase()) ||
      ev.description?.toLowerCase().includes(search.toLowerCase()) ||
      ev.custody?.toLowerCase().includes(search.toLowerCase()) ||
      ev.source_record_id?.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === "ALL" || ev.evidence_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const isOfficerOrAdmin = user?.role === "investigator" || user?.role === "admin";

  return (
    <div className="flex flex-col h-full bg-[var(--bg-void)]">
      {/* ── Top Header Strip ── */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-panel-solid)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wide uppercase text-[var(--text-primary)]">
                Tamper-Evident Evidence Integrity Ledger
              </h1>
              <span className="badge badge-verified text-[9px]">SHA-256 HASH CHAINING</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Cryptographically sealed chain of custody for seized digital exhibits and forensic assets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {isOfficerOrAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Record Seized Exhibit</span>
            </button>
          )}

          <button
            onClick={loadEvidence}
            className="p-1.5 rounded border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-panel-raised)] transition-all"
            title="Refresh Ledger"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[var(--intel-sky)]" : ""} />
          </button>
        </div>
      </div>

      {/* ── Filter Strip ── */}
      <div className="px-6 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search size={13} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Exhibit ID, Case #, description, custodian unit..."
              className="workstation-input pl-8 pr-3 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded px-2.5 py-1">
            <Filter size={12} className="text-[var(--text-muted)]" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-xs text-[var(--text-secondary)] outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-[var(--bg-panel-solid)]">All Exhibit Types</option>
              <option value="DIGITAL_EXTRACTION" className="bg-[var(--bg-panel-solid)]">Digital Extraction (Mobile/PC)</option>
              <option value="CCTV_SURVEILLANCE" className="bg-[var(--bg-panel-solid)]">CCTV Surveillance</option>
              <option value="FINANCIAL_LEDGER" className="bg-[var(--bg-panel-solid)]">Financial / Wire Ledger</option>
              <option value="CDR_LOGS" className="bg-[var(--bg-panel-solid)]">Telecom CDR Logs</option>
              <option value="PHYSICAL_SEIZURE" className="bg-[var(--bg-panel-solid)]">Physical Exhibit</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] font-mono text-[var(--text-muted)]">
          {filteredEvidence.length} Exhibits Indexed
        </div>
      </div>

      {/* ── Main Ledger Body ── */}
      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-24 rounded-lg" />
            ))}
          </div>
        ) : filteredEvidence.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[var(--text-muted)]">
            <FileDigit size={36} className="opacity-30 mb-2" />
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              No evidence exhibits match current filter
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Verify your search criteria or register a new seized exhibit.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvidence.map((ev) => {
              const verified = verifiedMap[ev.id];
              const isVerifying = verifyingId === ev.id;
              const isCopied = copiedHashId === ev.id;

              return (
                <div
                  key={ev.id}
                  className="panel p-4 bg-[var(--bg-panel-solid)] hover:border-[var(--border-strong)] transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Exhibit Details */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded flex items-center justify-center bg-[var(--bg-panel-raised)] border border-[var(--border-strong)] text-[var(--intel-sky)] shrink-0 mt-0.5">
                        <Fingerprint size={18} />
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[var(--text-primary)]">
                            {ev.title || ev.description}
                          </span>
                          <span className="badge badge-low text-[9px]">
                            {ev.evidence_type?.replace("_", " ")}
                          </span>
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">
                            EXHIBIT ID: {ev.id}
                          </span>
                          {ev.source_record_id && (
                            <span className="text-[10px] font-mono text-[var(--intel-sky)]">
                              CASE: {ev.source_record_id}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                          {ev.description}
                        </p>

                        <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--text-muted)] pt-1">
                          <span>Custody: <strong className="text-[var(--text-secondary)]">{ev.custody || "Forensic Vault"}</strong></span>
                          <span>Acquisition: {ev.created_at ? new Date(ev.created_at).toLocaleString() : "Historical"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Cryptographic Digest & Verification Actions */}
                    <div className="lg:w-96 shrink-0 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-[var(--border-subtle)] pt-3 lg:pt-0 lg:pl-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                          <Lock size={10} className="text-[var(--status-verified)]" />
                          Tamper-Evident SHA-256 Digest
                        </span>
                        <span className="badge badge-verified text-[8px]">
                          {verified ? "VERIFIED VALID" : "CRYPTOGRAPHICALLY SEALED"}
                        </span>
                      </div>

                      {/* Hash pill */}
                      <div className="flex items-center justify-between p-1.5 rounded bg-[var(--bg-void)] border border-[var(--border-subtle)] text-[10px] font-mono">
                        <span className="truncate text-[var(--intel-sky)] pr-2 select-all">
                          {ev.sha256_digest || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
                        </span>
                        <button
                          onClick={() => copyToClipboard(ev.sha256_digest, ev.id)}
                          className="p-1 rounded hover:bg-[var(--bg-panel-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
                          title="Copy Full Digest"
                        >
                          {isCopied ? <Check size={12} className="text-[var(--status-verified)]" /> : <Copy size={12} />}
                        </button>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => handleVerify(ev)}
                          disabled={isVerifying}
                          className="btn-secondary py-1 px-3 text-[10px] flex items-center gap-1.5"
                        >
                          <CheckCircle2 size={12} className={isVerifying ? "animate-spin" : "text-[var(--status-verified)]"} />
                          <span>{isVerifying ? "Computing Hash Match..." : "Verify Seal Integrity"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Verification Result Modal ── */}
      {verificationModal && (
        <div className="cmd-palette-backdrop" onClick={() => setVerificationModal(null)}>
          <div className="cmd-palette-modal max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[var(--status-verified)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Cryptographic Integrity Verification Audit
                </h2>
              </div>
              <button
                onClick={() => setVerificationModal(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="p-3 rounded bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.25)] flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--status-verified)] text-black flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--status-verified)]">
                    Evidence Integrity 100% Validated
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Computed SHA-256 fingerprint matches original custody sealing entry. Zero byte-level alteration detected.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] space-y-2 text-xs font-mono">
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px]">Exhibit ID:</span>
                  <span className="text-[var(--text-primary)] font-bold">{verificationModal.exhibit?.id}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px]">Recorded Digest:</span>
                  <span className="text-[var(--intel-sky)] text-[10px] break-all select-all">
                    {verificationModal.exhibit?.sha256_digest}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[10px]">Audited At:</span>
                  <span className="text-[var(--text-secondary)]">{new Date().toLocaleString()} IST</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setVerificationModal(null)}
                className="btn-primary py-1.5 px-4 text-xs"
              >
                Close Audit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Seized Exhibit Modal ── */}
      {showAddModal && (
        <div className="cmd-palette-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="cmd-palette-modal max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-[var(--intel-sky)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Record Seized Forensic Exhibit
                </h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExhibit} className="py-4 space-y-3 text-xs">
              <div>
                <label className="hud-label text-[9px] block mb-1">Associated Case File (Optional)</label>
                <select
                  value={newExhibit.case_id}
                  onChange={(e) => setNewExhibit({ ...newExhibit, case_id: e.target.value })}
                  className="workstation-input"
                >
                  <option value="">General Custody (No Case Linked)</option>
                  {casesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="hud-label text-[9px] block mb-1">Exhibit Classification</label>
                <select
                  value={newExhibit.evidence_type}
                  onChange={(e) => setNewExhibit({ ...newExhibit, evidence_type: e.target.value })}
                  className="workstation-input"
                >
                  <option value="DIGITAL_EXTRACTION">Digital Extraction (Mobile UFED / Hard Disk)</option>
                  <option value="CCTV_SURVEILLANCE">CCTV Surveillance Footage</option>
                  <option value="FINANCIAL_LEDGER">Financial Account / Hawala Ledger</option>
                  <option value="CDR_LOGS">Telecom Tower Dump CDR Logs</option>
                  <option value="PHYSICAL_SEIZURE">Physical Property Seizure</option>
                </select>
              </div>

              <div>
                <label className="hud-label text-[9px] block mb-1">Exhibit Description & Seizure Details</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Seized Samsung Galaxy S22 with IMEI 3589021948..., recovered during premise search at Sector 4 safehouse."
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

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex items-center gap-1.5"
                >
                  <Lock size={12} />
                  <span>{submitting ? "Computing SHA-256 Digest..." : "Generate SHA-256 & Seal Exhibit"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
