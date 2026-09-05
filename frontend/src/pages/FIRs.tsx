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
    <div className="flex h-full min-h-0 bg-[var(--bg-void)]">
      {/* ── Left Column: FIR Registry ── */}
      <div className="w-88 shrink-0 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-panel-solid)]">
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
                <FileText size={15} />
              </div>
              <div>
                <h1 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  FIR Complaint Registry
                </h1>
                <div className="text-[10px] font-mono text-[var(--text-muted)]">
                  {firs.length} POLICE COMPLAINTS
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="btn-primary py-1 px-2.5 text-[10px] flex items-center gap-1"
            >
              <Plus size={12} />
              <span>File FIR</span>
            </button>
          </div>

          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search FIR #, complainant, section..."
              className="workstation-input pl-7 text-xs"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {loading ? (
            [1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded" />)
          ) : firs.length === 0 ? (
            <div className="text-center py-10 text-xs text-[var(--text-muted)]">No FIRs found.</div>
          ) : (
            firs.map((f) => {
              const isSelected = selectedFir?.id === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => openFirDetail(f.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-all border ${
                    isSelected
                      ? "bg-[var(--bg-panel-raised)] border-[var(--intel-sky)]"
                      : "bg-[var(--bg-panel)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold text-[var(--intel-sky)]">
                      {f.fir_number}
                    </span>
                    <span className="text-[9px] font-mono text-[var(--text-muted)]">
                      {f.created_at ? new Date(f.created_at).toLocaleDateString() : "Historical"}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] line-clamp-2">
                    {f.narrative_text}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Column: Formal FIR Document Viewport ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-void)]">
        {selectedFir ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header Action Bar */}
            <div className="px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel-solid)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="badge badge-verified text-[9px]">OFFICIAL POLICE COMPLAINT</span>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  FIR NUMBER: {selectedFir.fir_number}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="btn-secondary py-1 px-3 text-xs flex items-center gap-1.5"
                >
                  <Printer size={13} />
                  <span>Print Copy</span>
                </button>
              </div>
            </div>

            {/* Document Content Viewport */}
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
              <div className="panel p-8 bg-[var(--bg-panel-solid)] border border-[var(--border-strong)] space-y-6">
                <div className="border-b border-[var(--border-strong)] pb-4 text-center">
                  <div className="text-xs font-mono tracking-widest uppercase text-[var(--text-muted)] font-bold">
                    STATE POLICE DEPARTMENT · FIRST INFORMATION REPORT (FIR)
                  </div>
                  <h1 className="text-base font-bold text-[var(--text-bright)] mt-1 font-mono">
                    {selectedFir.fir_number}
                  </h1>
                  <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                    Registered at: {selectedFir.district || "Central Sector"} Police Station
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs p-3 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
                  <div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] block">Date & Time of Registration:</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {selectedFir.created_at ? new Date(selectedFir.created_at).toLocaleString() : "Historical"} IST
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] block">Sector Jurisdiction:</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {selectedFir.district || "Central District"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="hud-label text-[10px] text-[var(--intel-sky)]">
                    ORIGINAL POLICE NARRATIVE & STATEMENTS
                  </div>
                  <div className="p-4 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
                    {renderHighlightedNarrative(selectedFir.narrative_text, selectedFir.extracted_entities || [])}
                  </div>
                </div>

                {/* Extracted Identifiers */}
                {selectedFir.extracted_entities?.length > 0 && (
                  <div className="space-y-2">
                    <div className="hud-label text-[10px] text-[var(--intel-sky)]">
                      AUTOMATICALLY EXTRACTED ENTITY IDENTIFIERS
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedFir.extracted_entities.map((ent: any, idx: number) => (
                        <span
                          key={idx}
                          onClick={() => navigate("/entities")}
                          className="px-2 py-1 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-[var(--intel-sky)] text-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <span className="font-bold text-[var(--text-primary)]">{ent.text}</span>
                          <span className="badge badge-low text-[8px]">{ent.type}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[var(--text-muted)]">
            <FileText size={40} className="opacity-20 mb-2" />
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              No FIR Selected
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Select an FIR complaint from the registry to view its official documentation.
            </p>
          </div>
        )}
      </div>

      {/* ── File New FIR Modal ── */}
      {showModal && (
        <div className="cmd-palette-backdrop" onClick={() => setShowModal(false)}>
          <div className="cmd-palette-modal max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-[var(--intel-sky)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Register First Information Report (FIR)
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-xs font-mono text-[var(--text-muted)]">
                ✕
              </button>
            </div>

            {submitSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={32} className="text-[var(--status-verified)] mx-auto" />
                <div className="text-xs font-bold text-[var(--status-verified)]">{submitSuccess}</div>
              </div>
            ) : (
              <form onSubmit={handleCreateFir} className="py-4 space-y-3 text-xs">
                <div>
                  <label className="hud-label text-[9px] block mb-1">FIR Number / Reference</label>
                  <input
                    required
                    placeholder="e.g. FIR-2026-0240"
                    value={newFirNumber}
                    onChange={(e) => setNewFirNumber(e.target.value)}
                    className="workstation-input"
                  />
                </div>

                <div>
                  <label className="hud-label text-[9px] block mb-1">Sector Station / District</label>
                  <select
                    value={newDistrict}
                    onChange={(e) => setNewDistrict(e.target.value)}
                    className="workstation-input"
                  >
                    <option value="Central">Central District Police Station</option>
                    <option value="North">North Sector Police Station</option>
                    <option value="South">South Sector Police Station</option>
                    <option value="Cyber">Cyber Crime Police Station</option>
                  </select>
                </div>

                <div>
                  <label className="hud-label text-[9px] block mb-1">Location of Occurrence</label>
                  <input
                    placeholder="e.g. Near Central Terminal Market"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="workstation-input"
                  />
                </div>

                <div>
                  <label className="hud-label text-[9px] block mb-1">Full Incident Narrative & Complaint Statement</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Paste or type statement. Suspect names, vehicle plates, and phone numbers will be automatically extracted into cross-case dossiers."
                    value={newNarrative}
                    onChange={(e) => setNewNarrative(e.target.value)}
                    className="workstation-input"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="btn-primary">
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
