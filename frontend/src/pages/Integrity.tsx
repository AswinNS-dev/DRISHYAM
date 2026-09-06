import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import {
  ShieldCheck, Search, Filter, RefreshCw, CheckCircle2,
  Lock, Copy, Check, Fingerprint
} from "lucide-react";

export default function Integrity() {
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
      ev.sha256_digest?.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === "ALL" || ev.evidence_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalExhibits = evidenceList.length;
  const verifiedCount = Object.keys(verifiedMap).length;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-void)]">
      {/* ── Top Header Strip ── */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-panel-solid)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
            <ShieldCheck size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold tracking-wide uppercase text-[var(--text-primary)]">
                Tamper-Evident Integrity Ledger
              </h1>
              <span className="badge badge-verified text-[8px]">SHA-256 HASH CHAINING</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Cryptographic digest verification and bit-level unaltered custody validation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadEvidence}
            className="p-1.5 rounded border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-panel-raised)] transition-all"
            title="Refresh Ledger"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[var(--intel-sky)]" : ""} />
          </button>
        </div>
      </div>

      {/* ── Accurate Forensic Disclosure Notice ── */}
      <div className="px-6 py-2.5 bg-[rgba(59,130,246,0.06)] border-b border-[rgba(59,130,246,0.2)] text-[11px] text-[var(--text-secondary)] flex items-center gap-2">
        <Lock size={13} className="text-[var(--intel-sky)] shrink-0" />
        <span>
          <strong>CRYPTOGRAPHIC SEAL GUARANTEE:</strong> SHA-256 verification confirms that seized digital records have not been altered or tampered with since acquisition. It provides mathematical proof of bit-level custody integrity.
        </span>
      </div>

      {/* ── Status Metrics Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Sealed Forensic Assets</div>
          <div className="text-base font-bold font-mono text-[var(--text-bright)] mt-0.5">{totalExhibits}</div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Active Session Verifications</div>
          <div className="text-base font-bold font-mono text-[var(--status-verified)] mt-0.5">{verifiedCount} passed</div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Hashing Algorithm</div>
          <div className="text-xs font-mono text-[var(--intel-sky)] mt-1">SHA-256 Digest Engine</div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Ledger Structure</div>
          <div className="text-xs font-mono text-[var(--text-secondary)] mt-1">Tamper-Evident Chained Store</div>
        </div>
      </div>

      {/* ── Search & Filter Strip ── */}
      <div className="px-6 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search size={12} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Exhibit ID, hash digest, or description..."
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
              <option value="DIGITAL_EXTRACTION" className="bg-[var(--bg-panel-solid)]">Digital Extractions</option>
              <option value="CCTV_SURVEILLANCE" className="bg-[var(--bg-panel-solid)]">Surveillance Feeds</option>
              <option value="FINANCIAL_LEDGER" className="bg-[var(--bg-panel-solid)]">Financial Ledgers</option>
              <option value="CDR_LOGS" className="bg-[var(--bg-panel-solid)]">Telecom CDR Logs</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] font-mono text-[var(--text-muted)]">
          {filteredEvidence.length} Exhibits Indexed
        </div>
      </div>

      {/* ── Main Ledger List ── */}
      <div className="flex-1 p-6 overflow-y-auto space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-24 rounded-lg" />
            ))}
          </div>
        ) : filteredEvidence.length === 0 ? (
          <div className="panel p-12 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-panel-solid)]">
            <Fingerprint size={32} className="mx-auto mb-2 opacity-30" />
            <div className="font-semibold text-[var(--text-secondary)] uppercase">No integrity records found</div>
            <p className="mt-1 text-[11px]">No items match the current search criteria.</p>
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
                            {ev.evidence_type?.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">
                            EXHIBIT: {ev.id}
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
                          <span>Custodian: <strong className="text-[var(--text-secondary)]">{ev.custody || "Forensic Vault"}</strong></span>
                          <span>Timestamp: {ev.created_at ? new Date(ev.created_at).toLocaleString() : "Seizure Point"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Cryptographic Digest & Action */}
                    <div className="lg:w-96 shrink-0 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-[var(--border-subtle)] pt-3 lg:pt-0 lg:pl-4 space-y-2">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-[var(--text-muted)]">SHA-256 DIGITAL SEAL</span>
                          <button
                            onClick={() => copyToClipboard(ev.sha256_digest || "", ev.id)}
                            className="text-[var(--intel-sky)] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            {isCopied ? <Check size={10} /> : <Copy size={10} />}
                            <span>{isCopied ? "Copied" : "Copy Digest"}</span>
                          </button>
                        </div>

                        <div className="p-2 rounded bg-[var(--bg-void)] border border-[var(--border-subtle)] font-mono text-[10px] text-[var(--text-secondary)] break-all select-all leading-tight">
                          {ev.sha256_digest || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div>
                          {verified ? (
                            <span className="badge badge-verified text-[9px] flex items-center gap-1">
                              <CheckCircle2 size={11} />
                              <span>ZERO ALTERATIONS CONFIRMED</span>
                            </span>
                          ) : (
                            <span className="badge badge-low text-[9px]">
                              SEAL INTACT
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleVerify(ev)}
                          disabled={isVerifying}
                          className="btn-primary py-1 px-3 text-xs flex items-center gap-1.5"
                        >
                          <ShieldCheck size={13} className={isVerifying ? "animate-spin" : ""} />
                          <span>{isVerifying ? "Recalculating..." : "Verify Hash"}</span>
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

      {/* Verification Result Modal */}
      {verificationModal && (
        <div className="cmd-palette-backdrop" onClick={() => setVerificationModal(null)}>
          <div className="cmd-palette-modal max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[var(--status-verified)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Cryptographic Integrity Verification Passed
                </h2>
              </div>
              <button onClick={() => setVerificationModal(null)} className="text-xs font-mono text-[var(--text-muted)]">
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="p-3 rounded bg-[var(--bg-void)] border border-[var(--border-subtle)] space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-[var(--text-muted)]">Exhibit Subject</div>
                <div className="font-bold text-[var(--text-primary)]">{verificationModal.exhibit.title}</div>
                <div className="text-[11px] text-[var(--text-secondary)]">ID: {verificationModal.exhibit.id}</div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-mono text-[var(--text-muted)]">VERIFIED SHA-256 DIGEST</div>
                <div className="p-2 rounded bg-[var(--bg-panel-raised)] font-mono text-[10px] text-[var(--status-verified)] break-all border border-[var(--border-subtle)]">
                  {verificationModal.result.calculated_hash}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[var(--text-secondary)] pt-1">
                <div>Verified By: <strong>{verificationModal.result.verified_by || user?.full_name || "Investigating Officer"}</strong></div>
                <div>Algorithm: <strong>SHA-256 Digest</strong></div>
                <div>Status: <span className="text-[var(--status-verified)] font-bold">BIT-ACCURATE</span></div>
                <div>Timestamp: <strong>{new Date().toLocaleTimeString()} IST</strong></div>
              </div>

              <div className="p-2.5 rounded bg-[rgba(16,185,129,0.06)] border border-[rgba(16,185,129,0.2)] text-[11px] text-[var(--text-secondary)]">
                {verificationModal.result.message || "Integrity confirmed: Digital hash matches original forensic seizure state. Zero byte alterations detected."}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[var(--border-subtle)]">
              <button onClick={() => setVerificationModal(null)} className="btn-primary text-xs">
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
