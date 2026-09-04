import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  FileText, Search, Plus, Calendar, MapPin, Shield, Users,
  ExternalLink, ChevronRight, X, Sparkles, CheckCircle2
} from "lucide-react";

export default function FIRs() {
  const navigate = useNavigate();
  const [firs, setFirs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedFir, setSelectedFir] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // New FIR modal state
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
        setFirs(res.firs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(loadFirs, 250);
    return () => clearTimeout(timer);
  }, [search]);

  function openFirDetail(firId: string) {
    setDetailLoading(true);
    api.firDetail(firId)
      .then((res) => {
        setSelectedFir(res.fir);
        setDetailLoading(false);
      })
      .catch(() => setDetailLoading(false));
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
      setSubmitSuccess(`FIR ${newFirNumber} filed successfully with ${res.extracted_entities_count} automated entity detections!`);
      setNewFirNumber("");
      setNewNarrative("");
      setNewLocation("");
      loadFirs();
      setTimeout(() => {
        setSubmitSuccess(null);
        setShowModal(false);
      }, 2000);
    } catch (err: any) {
      alert("Failed to submit FIR: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Render narrative with color-coded entity highlights
  function renderHighlightedNarrative(text: string, mentions: any[]) {
    if (!mentions || mentions.length === 0) {
      return <p className="text-xs leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">{text}</p>;
    }

    // Sort mentions by span start
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

        let bg = "rgba(45,212,191,0.18)";
        let border = "var(--neon-teal)";
        let textCol = "#5eead4";

        if (m.type === "PHONE") {
          bg = "rgba(0,255,255,0.18)";
          border = "var(--neon-cyan)";
          textCol = "#67e8f9";
        } else if (m.type === "VEHICLE") {
          bg = "rgba(245,158,11,0.2)";
          border = "var(--neon-amber)";
          textCol = "#fcd34d";
        } else if (m.type === "LOCATION") {
          bg = "rgba(168,85,247,0.2)";
          border = "#c084fc";
          textCol = "#d8b4fe";
        } else if (m.type === "LEGAL_SECTION") {
          bg = "rgba(244,63,94,0.2)";
          border = "var(--accent-red)";
          textCol = "#fda4af";
        }

        elements.push(
          <mark
            key={`mention-${idx}`}
            title={`${m.type} (${(m.confidence * 100).toFixed(0)}% confidence)`}
            className="rounded px-1.5 py-0.5 mx-0.5 text-xs font-semibold cursor-pointer transition-all inline-flex items-center gap-1"
            style={{
              backgroundColor: bg,
              color: textCol,
              border: `1px solid ${border}`,
            }}
            onClick={() => {
              if (m.resolved_entity_id) {
                navigate(`/entities`);
              }
            }}
          >
            <span>{text.substring(m.start, m.end)}</span>
            <span className="text-[9px] uppercase tracking-tighter opacity-75 font-mono">[{m.type}]</span>
          </mark>
        );
        lastIndex = m.end;
      }
    });

    if (lastIndex < text.length) {
      elements.push(
        <span key="tail">{text.substring(lastIndex)}</span>
      );
    }

    return <div className="text-xs leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">{elements}</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-void)]">
      {/* ── Top HUD Header ── */}
      <div
        className="px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 glass-panel"
        style={{ borderColor: "var(--border-subtle)", borderRadius: 0 }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(45,212,191,0.2), rgba(0,255,255,0.05))",
              border: "1px solid rgba(45,212,191,0.3)",
              boxShadow: "0 0 12px rgba(45,212,191,0.2)",
            }}
          >
            <FileText size={18} color="var(--neon-teal)" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wide uppercase text-[var(--text-primary)]">
                First Information Reports (FIRs)
              </h1>
              <span className="hud-label text-[9px] text-[var(--neon-teal)]">POLICE REPOSITORY</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Official police complaints parsed into verifiable entity intelligence graphs
            </p>
          </div>
        </div>

        {/* Search & Action */}
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search size={13} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search FIR # or narrative text..."
              className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)]"
            />
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--neon-teal)] text-[#08211d] hover:shadow-[0_0_12px_rgba(45,212,191,0.4)] transition-all"
          >
            <Plus size={14} />
            <span>Register FIR</span>
          </button>
        </div>
      </div>

      {/* ── Main Layout: FIR Grid + Sliding Dossier ── */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* FIR Cards List */}
        <div className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="glass-panel p-5 animate-pulse h-44 rounded-xl border border-[var(--border-subtle)]" />
              ))}
            </div>
          ) : firs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[var(--text-muted)]">
              <FileText size={32} className="opacity-40 mb-3" />
              <div className="text-sm font-semibold">No FIR records found matching query</div>
              <p className="text-xs text-[var(--text-muted)] mt-1">Try adjusting search keywords or register a new FIR.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {firs.map((f) => (
                <div
                  key={f.id}
                  onClick={() => openFirDetail(f.id)}
                  className={`glass-panel p-4 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                    selectedFir?.id === f.id
                      ? "border-[var(--neon-teal)] shadow-[0_0_15px_rgba(45,212,191,0.2)] bg-[rgba(45,212,191,0.04)]"
                      : "border-[var(--border-subtle)] hover:border-[rgba(45,212,191,0.4)] hover:bg-[rgba(255,255,255,0.02)]"
                  }`}
                >
                  <div>
                    {/* Header line */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[var(--neon-teal)]">
                          {f.fir_number}
                        </span>
                        {f.case_number && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[rgba(0,255,255,0.08)] text-[var(--neon-cyan)] border border-[rgba(0,255,255,0.2)]">
                            {f.case_number}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1">
                        <Calendar size={11} />
                        {f.filed_at ? new Date(f.filed_at).toLocaleDateString() : "Recent"}
                      </span>
                    </div>

                    {/* Case / Title */}
                    {f.case_title && (
                      <div className="text-xs font-bold text-[var(--text-primary)] mb-1 truncate">
                        {f.case_title}
                      </div>
                    )}

                    {/* Narrative snippet */}
                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-3 leading-relaxed mb-3">
                      {f.narrative_preview}
                    </p>
                  </div>

                  {/* Footer metadata */}
                  <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1 text-[var(--text-muted)]">
                      <MapPin size={11} className="text-[var(--neon-amber)]" />
                      <span>{f.district || f.location_name || "District North"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[var(--neon-teal)] font-medium">
                      <Users size={11} />
                      <span>{f.entity_count || 3} Entities Mapped</span>
                      <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Slide-in FIR Detail Reading Room (Right Panel) ── */}
        {selectedFir && (
          <div
            className="w-[500px] shrink-0 border-l flex flex-col min-h-0 glass-panel relative z-20 animate-in slide-in-from-right duration-300"
            style={{ borderColor: "var(--border-subtle)", borderRadius: 0 }}
          >
            {/* Drawer Header */}
            <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "var(--border-subtle)" }}>
              <div>
                <div className="text-[10px] font-mono text-[var(--neon-teal)] uppercase tracking-wider">
                  OFFICIAL POLICE COMPLAINT DOSSIER
                </div>
                <h2 className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                  FIR: {selectedFir.fir_number}
                </h2>
              </div>
              <button
                onClick={() => setSelectedFir(null)}
                className="p-1 rounded-lg hover:bg-[rgba(255,255,255,0.06)] text-[var(--text-muted)] hover:text-white transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {detailLoading ? (
                <div className="py-20 text-center text-xs text-[var(--text-muted)]">Loading full FIR records...</div>
              ) : (
                <>
                  {/* Case & Location Banner */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
                      <div className="text-[9px] font-mono uppercase text-[var(--text-muted)]">Parent Case</div>
                      <div className="text-xs font-semibold text-[var(--text-primary)] mt-0.5">
                        {selectedFir.case?.case_number || "Unlinked Case"}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] truncate">
                        {selectedFir.case?.title || "Direct FIR Registration"}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
                      <div className="text-[9px] font-mono uppercase text-[var(--text-muted)]">Jurisdiction</div>
                      <div className="text-xs font-semibold text-[var(--text-primary)] mt-0.5">
                        {selectedFir.location?.district || "Central Police Station"}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] truncate">
                        {selectedFir.location?.name || "Patrol Sector 4"}
                      </div>
                    </div>
                  </div>

                  {/* Accused Suspects */}
                  {selectedFir.accused_entities?.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-red)] mb-2 flex items-center gap-1.5">
                        <Shield size={12} /> Accused Operatives ({selectedFir.accused_entities.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedFir.accused_entities.map((acc: any) => (
                          <div
                            key={acc.id}
                            className="px-2.5 py-1 rounded-lg bg-[rgba(244,63,94,0.1)] border border-[rgba(244,63,94,0.3)] text-xs text-[var(--accent-red)] font-medium flex items-center gap-1.5"
                          >
                            <span>{acc.name}</span>
                            <span className="text-[9px] font-mono opacity-80">({(acc.confidence * 100).toFixed(0)}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inline Highlighted Narrative Box */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--neon-teal)] flex items-center gap-1.5">
                        <Sparkles size={13} />
                        Parsed Incident Narrative
                      </div>
                      <span className="text-[9px] font-mono text-[var(--text-muted)]">
                        {selectedFir.mentions?.length || 0} ENTITIES EXTRACTED
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-[rgba(10,14,24,0.7)] border border-[var(--border-subtle)] relative overflow-hidden font-sans">
                      {/* Legend Chips */}
                      <div className="flex flex-wrap gap-1.5 mb-3 pb-2.5 border-b border-[rgba(255,255,255,0.06)] text-[9px] font-mono uppercase">
                        <span className="px-1.5 py-0.5 rounded bg-[rgba(45,212,191,0.15)] text-[#5eead4] border border-[rgba(45,212,191,0.3)]">Person</span>
                        <span className="px-1.5 py-0.5 rounded bg-[rgba(0,255,255,0.15)] text-[#67e8f9] border border-[rgba(0,255,255,0.3)]">Phone</span>
                        <span className="px-1.5 py-0.5 rounded bg-[rgba(245,158,11,0.15)] text-[#fcd34d] border border-[rgba(245,158,11,0.3)]">Vehicle</span>
                        <span className="px-1.5 py-0.5 rounded bg-[rgba(168,85,247,0.15)] text-[#d8b4fe] border border-[rgba(168,85,247,0.3)]">Location</span>
                        <span className="px-1.5 py-0.5 rounded bg-[rgba(244,63,94,0.15)] text-[#fda4af] border border-[rgba(244,63,94,0.3)]">Legal Section</span>
                      </div>

                      {renderHighlightedNarrative(selectedFir.narrative_text, selectedFir.mentions)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => navigate("/network")}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-[var(--neon-teal)] text-[#08211d] hover:shadow-[0_0_12px_rgba(45,212,191,0.3)] transition-all flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink size={13} />
                      Inspect in Neural Graph
                    </button>
                    <button
                      onClick={() => navigate("/timeline")}
                      className="py-2 px-3 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white hover:border-[var(--neon-teal)] transition-all flex items-center gap-1.5"
                    >
                      <Calendar size={13} />
                      Event Timeline
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Register FIR Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel p-6 rounded-2xl border border-[var(--border-subtle)] w-full max-w-lg shadow-[0_0_30px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[var(--neon-teal)]" />
                <h3 className="text-sm font-bold uppercase text-[var(--text-primary)]">Register New Police FIR</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-muted)] hover:text-white">
                <X size={16} />
              </button>
            </div>

            {submitSuccess ? (
              <div className="p-4 rounded-xl bg-[rgba(45,212,191,0.1)] border border-[rgba(45,212,191,0.3)] text-center space-y-2">
                <CheckCircle2 size={24} className="text-[var(--neon-teal)] mx-auto" />
                <div className="text-xs font-semibold text-[var(--neon-teal)]">{submitSuccess}</div>
              </div>
            ) : (
              <form onSubmit={handleCreateFir} className="space-y-4">
                <div>
                  <label className="text-[10px] font-mono uppercase text-[var(--text-muted)] block mb-1">
                    FIR Registration Number *
                  </label>
                  <input
                    required
                    value={newFirNumber}
                    onChange={(e) => setNewFirNumber(e.target.value)}
                    placeholder="e.g. FIR-2024-889"
                    className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-[var(--text-muted)] block mb-1">
                      Incident Location
                    </label>
                    <input
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="e.g. MG Road Junction"
                      className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-[var(--text-muted)] block mb-1">
                      Police District
                    </label>
                    <select
                      value={newDistrict}
                      onChange={(e) => setNewDistrict(e.target.value)}
                      className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)]"
                    >
                      <option value="Central">Central District</option>
                      <option value="North">North Zone</option>
                      <option value="South">South Zone</option>
                      <option value="East">East Zone</option>
                      <option value="West">West Zone</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-[var(--text-muted)] block mb-1">
                    Complaint Narrative Text * (NLP engine will auto-detect entities)
                  </label>
                  <textarea
                    required
                    rows={5}
                    value={newNarrative}
                    onChange={(e) => setNewNarrative(e.target.value)}
                    placeholder="Complainant states that accused Ravi alias Rocky was observed with Arjun at Central Market in vehicle KA01AB1234 using phone 9876543210..."
                    className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg p-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)] font-mono leading-relaxed"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-[var(--neon-teal)] text-[#08211d] hover:shadow-[0_0_12px_rgba(45,212,191,0.3)] disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    <Sparkles size={13} />
                    {submitting ? "Extracting & Filing..." : "File FIR & Run NLP Extraction"}
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
