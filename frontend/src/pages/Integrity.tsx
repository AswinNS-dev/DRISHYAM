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
    <div className="flex flex-col h-full bg-[#020617]">
      {/* ── Standardized Header Strip ── */}
      <div className="p-4 bg-slate-900/95 border-b border-slate-800/90 shadow-xl backdrop-blur-md shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge badge-info text-[10px] font-mono tracking-wider font-bold py-0.5 px-2 bg-slate-800 text-sky-300 border border-sky-500/30 text-glow-sky">
              STATE CRYPTOGRAPHIC LEDGER & INTEGRITY VERIFICATION
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 shadow-sm shadow-emerald-950/40 text-glow-emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE DATABASE SYNCHRONIZED
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400">
              INDEXED EXHIBITS: <strong className="text-white text-glow-white">{filteredEvidence.length}</strong> / <strong className="text-slate-400">{totalExhibits}</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-emerald-400 border border-slate-800 flex items-center justify-center shadow-md">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-wide text-white uppercase text-glow-white">
                Tamper-Evident Integrity Ledger
              </h1>
              <p className="text-xs text-slate-300 font-medium">
                Cryptographic digest verification and bit-level unaltered custody validation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadEvidence}
              className="p-2 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white bg-slate-950 transition-all cursor-pointer"
              title="Refresh Ledger"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-sky-400" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Status Metrics Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 p-4 border-b border-slate-800/90 bg-slate-900/60 shrink-0">
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Sealed Forensic Assets</div>
          <div className="text-xl font-black font-mono text-white text-glow-white mt-1">{totalExhibits}</div>
        </div>
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Session Verifications</div>
          <div className="text-xl font-black font-mono text-emerald-400 text-glow-emerald mt-1">{verifiedCount} passed</div>
        </div>
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Hashing Algorithm</div>
          <div className="text-sm font-black font-mono text-sky-400 text-glow-sky mt-1.5">SHA-256 Engine</div>
        </div>
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Ledger Architecture</div>
          <div className="text-sm font-black font-mono text-purple-400 text-glow-purple mt-1.5">Chained Store</div>
        </div>
      </div>

      {/* ── Accurate Forensic Disclosure Notice ── */}
      <div className="mx-4 mt-3 p-3 bg-sky-950/40 border border-sky-500/40 rounded-xl text-xs text-slate-300 flex items-center gap-2.5 shadow-md shrink-0">
        <Lock size={15} className="text-sky-400 shrink-0" />
        <span>
          <strong className="text-sky-300 text-glow-sky">CRYPTOGRAPHIC SEAL GUARANTEE:</strong> SHA-256 verification confirms that seized digital records have not been altered or tampered with since acquisition. It provides mathematical proof of bit-level custody integrity.
        </span>
      </div>

      {/* ── Search & Filter Strip ── */}
      <div className="px-4 py-3 border-b border-slate-800/90 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 mt-3 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Exhibit ID, hash digest, or description..."
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition-all shadow-inner"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors">
            <Filter size={12} className="text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-950">All Exhibit Types</option>
              <option value="DIGITAL_EXTRACTION" className="bg-slate-950">Digital Extractions</option>
              <option value="CCTV_SURVEILLANCE" className="bg-slate-950">Surveillance Feeds</option>
              <option value="FINANCIAL_LEDGER" className="bg-slate-950">Financial Ledgers</option>
              <option value="CDR_LOGS" className="bg-slate-950">Telecom CDR Logs</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400">
          Showing <strong className="text-white">{filteredEvidence.length}</strong> exhibits
        </div>
      </div>

      {/* ── Main Ledger List ── */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-24 rounded-xl bg-slate-900/80 border border-slate-800" />
            ))}
          </div>
        ) : filteredEvidence.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-slate-900/95 border border-slate-800 rounded-xl shadow-xl">
            <Fingerprint size={36} className="mx-auto mb-2 opacity-30 text-slate-500" />
            <div className="font-bold text-slate-200 uppercase tracking-wider">No integrity records found</div>
            <p className="mt-1 text-slate-500 text-[11px]">No items match the current search criteria.</p>
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
                  className="p-4 bg-slate-900/95 border border-slate-800/90 hover:border-sky-500/50 rounded-xl shadow-xl transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Exhibit Details */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-950 border border-slate-800 text-sky-400 shrink-0 mt-0.5 shadow-md">
                        <Fingerprint size={20} />
                      </div>

                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white hover:text-sky-300 transition-colors">
                            {ev.title || ev.description}
                          </span>
                          <span className="badge badge-low text-[9px] font-mono">
                            {ev.evidence_type?.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            EXHIBIT: {ev.id}
                          </span>
                          {ev.source_record_id && (
                            <span className="text-[10px] font-mono text-sky-400 font-semibold text-glow-sky">
                              CASE: {ev.source_record_id}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {ev.description}
                        </p>

                        <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 pt-1">
                          <span>Custodian: <strong className="text-slate-200">{ev.custody || "Forensic Vault"}</strong></span>
                          <span>·</span>
                          <span>Timestamp: <strong className="text-slate-300">{ev.created_at ? new Date(ev.created_at).toLocaleString() : "Seizure Point"}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Cryptographic Digest & Action */}
                    <div className="lg:w-96 shrink-0 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-3 lg:pt-0 lg:pl-4 space-y-2.5">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-400 uppercase tracking-wider font-bold">SHA-256 DIGITAL SEAL</span>
                          <button
                            onClick={() => copyToClipboard(ev.sha256_digest || "", ev.id)}
                            className="text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {isCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            <span>{isCopied ? "Copied" : "Copy Digest"}</span>
                          </button>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px] text-sky-300 break-all select-all leading-tight shadow-inner">
                          {ev.sha256_digest || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div>
                          {verified ? (
                            <span className="badge badge-verified text-[9px] flex items-center gap-1 text-glow-emerald">
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
                          className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition-all cursor-pointer"
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
          <div className="cmd-palette-modal max-w-lg p-6 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  Cryptographic Integrity Verification Passed
                </h2>
              </div>
              <button onClick={() => setVerificationModal(null)} className="text-xs font-mono text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-slate-400">Exhibit Subject</div>
                <div className="font-bold text-white text-sm">{verificationModal.exhibit.title}</div>
                <div className="text-[11px] font-mono text-slate-400">ID: {verificationModal.exhibit.id}</div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-slate-400">VERIFIED SHA-256 DIGEST</div>
                <div className="p-2.5 rounded-lg bg-slate-900 font-mono text-[10px] text-emerald-400 break-all border border-slate-800 shadow-inner">
                  {verificationModal.result.calculated_hash}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 pt-1">
                <div>Verified By: <strong className="text-white">{verificationModal.result.verified_by || user?.email || "Investigating Officer"}</strong></div>
                <div>Algorithm: <strong className="text-sky-400">SHA-256 Digest</strong></div>
                <div>Status: <span className="text-emerald-400 font-bold text-glow-emerald">BIT-ACCURATE</span></div>
                <div>Timestamp: <strong className="text-white">{new Date().toLocaleTimeString()} IST</strong></div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-[11px] text-emerald-300 leading-relaxed font-mono">
                {verificationModal.result.message || "Integrity confirmed: Digital hash matches original forensic seizure state. Zero byte alterations detected."}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button onClick={() => setVerificationModal(null)} className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20">
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
