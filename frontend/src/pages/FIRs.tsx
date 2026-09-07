import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  FileText, Search, Plus, CheckCircle2, Printer
} from "lucide-react";

export default function FIRs() {
  const navigate = useNavigate();
  const [firs, setFirs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedFir, setSelectedFir] = useState<any | null>(null);

  // New FIR modal
  const [showModal, setShowModal] = useState(false);
  const [newFirNumber, setNewFirNumber] = useState("");
  const [newNarrative, setNewNarrative] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newDistrict, setNewDistrict] = useState("Central");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  function loadFirs() {
    setLoading(true);
    api.firs(search)
      .then((res) => {
        const list = res.firs || [];
        setFirs(list);
        if (list.length > 0 && !selectedFir) {
          openFirDetail(list[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(loadFirs, 250);
    return () => clearTimeout(timer);
  }, [search]);

  function openFirDetail(firId: string) {
    api.firDetail(firId)
      .then((res) => {
        setSelectedFir(res.fir);
      })
      .catch(() => {});
  }

  async function handleCreateFir(e: React.FormEvent) {
    e.preventDefault();
    if (!newFirNumber || !newNarrative) return;
    setSubmitting(true);
    try {
      const res = await api.createFir({
        fir_number: newFirNumber,
        narrative_text: newNarrative,
        location_name: newLocation || undefined,
        district: newDistrict,
      });
      setSubmitSuccess(`FIR ${newFirNumber} registered successfully with ${res.extracted_entities_count || 0} automated detections!`);
      setNewFirNumber("");
      setNewNarrative("");
      setNewLocation("");
      loadFirs();
      setTimeout(() => {
        setSubmitSuccess(null);
        setShowModal(false);
      }, 1800);
    } catch (err: any) {
      alert("Failed to submit FIR: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function renderHighlightedNarrative(text: string, mentions: any[]) {
    if (!mentions || mentions.length === 0) {
      return <p className="text-xs leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">{text}</p>;
    }

    const sorted = [...mentions].filter((m) => m.start !== null && m.end !== null).sort((a, b) => a.start - b.end);
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    sorted.forEach((m, idx) => {
      if (m.start >= lastIndex && m.end <= text.length) {
        if (m.start > lastIndex) {
          elements.push(
            <span key={`text-${idx}`}>{text.substring(lastIndex, m.start)}</span>
          );
        }

        elements.push(
          <mark
            key={`mention-${idx}`}
            title={`${m.type} (Detected identifier)`}
            className="rounded px-1.5 py-0.5 mx-0.5 text-xs font-semibold cursor-pointer inline-flex items-center gap-1 bg-[rgba(37,99,235,0.15)] text-[var(--intel-sky)] border border-[rgba(37,99,235,0.3)]"
            onClick={() => {
              if (m.resolved_entity_id) {
                navigate(`/entities`);
              }
            }}
          >
            <span>{text.substring(m.start, m.end)}</span>
            <span className="text-[9px] uppercase font-mono opacity-75">[{m.type}]</span>
          </mark>
        );
        lastIndex = m.end;
      }
    });

    if (lastIndex < text.length) {
      elements.push(<span key="text-end">{text.substring(lastIndex)}</span>);
    }

    return <div className="text-xs leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">{elements}</div>;
  }

  return (
    <div className="flex h-full min-h-0 bg-[#020617]">
      {/* ── Left Column: FIR Registry ── */}
      <div className="w-96 shrink-0 flex flex-col border-r border-slate-800/90 bg-slate-900/95 shadow-xl">
        <div className="p-4 border-b border-slate-800/90 bg-slate-950/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="badge badge-info text-[9px] font-mono tracking-wider font-bold py-0.5 px-2 bg-slate-800 text-sky-300 border border-sky-500/30 text-glow-sky">
              STATE FIRST INFORMATION REPORT (FIR) REGISTRY
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-950 text-sky-400 border border-slate-800 flex items-center justify-center shadow-md">
                <FileText size={18} />
              </div>
              <div>
                <h1 className="text-sm font-black uppercase tracking-wider text-white text-glow-white">
                  FIR Complaint Registry
                </h1>
                <div className="text-[10px] font-mono text-slate-400">
                  {firs.length} POLICE COMPLAINTS
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-md shadow-sky-500/20 transition-all cursor-pointer"
            >
              <Plus size={13} />
              <span>File FIR</span>
            </button>
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search FIR #, complainant, section..."
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition-all shadow-inner"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            [1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl bg-slate-900/80 border border-slate-800" />)
          ) : firs.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500 font-mono">No FIRs found.</div>
          ) : (
            firs.map((f) => {
              const isSelected = selectedFir?.id === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => openFirDetail(f.id)}
                  className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? "bg-slate-900 border-sky-500/80 shadow-lg shadow-sky-950/40 text-white"
                      : "bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/50 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-sky-400 text-glow-sky">
                      {f.fir_number}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {f.created_at ? new Date(f.created_at).toLocaleDateString() : "Historical"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {f.narrative_text}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Column: Formal FIR Document Viewport ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#020617]">
        {selectedFir ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header Action Bar */}
            <div className="px-6 py-3.5 border-b border-slate-800/90 bg-slate-900/95 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="badge badge-verified text-[9px] font-mono text-glow-emerald">OFFICIAL POLICE COMPLAINT</span>
                <span className="text-[11px] font-mono text-slate-400">
                  FIR NUMBER: <strong className="text-white font-bold">{selectedFir.fir_number}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Printer size={13} />
                  <span>Print Copy</span>
                </button>
              </div>
            </div>

            {/* Document Content Viewport */}
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
              <div className="p-8 bg-slate-900/95 border border-slate-800/90 rounded-2xl shadow-2xl space-y-6">
                <div className="border-b border-slate-800 pb-5 text-center">
                  <div className="text-xs font-mono tracking-widest uppercase text-slate-400 font-bold">
                    STATE POLICE DEPARTMENT · FIRST INFORMATION REPORT (FIR)
                  </div>
                  <h1 className="text-xl font-black text-white mt-1.5 font-mono tracking-wide uppercase text-glow-white">
                    {selectedFir.fir_number}
                  </h1>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    Registered at: <strong className="text-slate-300">{selectedFir.district || "Central Sector"} Police Station</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-inner">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Date & Time of Registration:</span>
                    <span className="font-semibold text-white mt-0.5 block font-mono">
                      {selectedFir.created_at ? new Date(selectedFir.created_at).toLocaleString() : "Historical"} IST
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Sector Jurisdiction:</span>
                    <span className="font-semibold text-white mt-0.5 block">
                      {selectedFir.district || "Central District"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-mono uppercase text-sky-400 font-bold tracking-wider text-glow-sky">
                    ORIGINAL POLICE NARRATIVE & STATEMENTS
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                    {renderHighlightedNarrative(selectedFir.narrative_text, selectedFir.extracted_entities || [])}
                  </div>
                </div>

                {/* Extracted Identifiers */}
                {selectedFir.extracted_entities?.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono uppercase text-sky-400 font-bold tracking-wider text-glow-sky">
                      AUTOMATICALLY EXTRACTED ENTITY IDENTIFIERS
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedFir.extracted_entities.map((ent: any, idx: number) => (
                        <span
                          key={idx}
                          onClick={() => navigate("/entities")}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-sky-500 text-xs cursor-pointer flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                          <span className="font-bold text-white hover:text-sky-300">{ent.text}</span>
                          <span className="badge badge-low text-[8px] font-mono">{ent.type}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
            <FileText size={44} className="opacity-20 mb-2 text-slate-500" />
            <div className="text-sm font-bold uppercase tracking-wider text-slate-300">
              No FIR Selected
            </div>
            <p className="text-xs text-slate-500 max-w-sm">
              Select an FIR complaint from the registry to view its official documentation.
            </p>
          </div>
        )}
      </div>

      {/* ── File New FIR Modal ── */}
      {showModal && (
        <div className="cmd-palette-backdrop" onClick={() => setShowModal(false)}>
          <div className="cmd-palette-modal max-w-lg p-6 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-sky-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Register First Information Report (FIR)
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-xs font-mono text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {submitSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
                <div className="text-xs font-bold text-emerald-400 font-mono text-glow-emerald">{submitSuccess}</div>
              </div>
            ) : (
              <form onSubmit={handleCreateFir} className="py-4 space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1 font-bold">FIR Number / Reference</label>
                  <input
                    required
                    placeholder="e.g. FIR-2026-0240"
                    value={newFirNumber}
                    onChange={(e) => setNewFirNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1 font-bold">Sector Station / District</label>
                  <select
                    value={newDistrict}
                    onChange={(e) => setNewDistrict(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
                  >
                    <option value="Central">Central District Police Station</option>
                    <option value="North">North Sector Police Station</option>
                    <option value="South">South Sector Police Station</option>
                    <option value="Cyber">Cyber Crime Police Station</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1 font-bold">Location of Occurrence</label>
                  <input
                    placeholder="e.g. Near Central Terminal Market"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1 font-bold">Full Incident Narrative & Complaint Statement</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Paste or type statement. Suspect names, vehicle plates, and phone numbers will be automatically extracted into cross-case dossiers."
                    value={newNarrative}
                    onChange={(e) => setNewNarrative(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono text-xs">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20">
                    {submitting ? "Registering & Extracting..." : "File FIR Complaint"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
