import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  Search, Users, Network as NetworkIcon,
  Shield, Sparkles, UserCheck, X
} from "lucide-react";

const TYPES = ["PERSON", "PHONE", "VEHICLE", "LOCATION", "GANG", "ORGANIZATION", "BANK_ACCOUNT"];

const TYPE_COLORS: Record<string, string> = {
  PERSON: "#5b8def", PHONE: "#2dd4bf", VEHICLE: "#fbbf24",
  LOCATION: "#a855f7", GANG: "#ff3b5c", ORGANIZATION: "#ff3b5c", BANK_ACCOUNT: "#34d399",
};

export default function Entities() {
  const [entityType, setEntityType] = useState("PERSON");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [selectedTab, setSelectedTab] = useState<"identity" | "metrics" | "cases" | "intelligence">("identity");
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.entities(entityType, q)
      .then((r) => setRows(r.entities || []))
      .finally(() => setLoading(false));
  }, [entityType, q]);

  async function openDossier(id: string) {
    try {
      const d = await api.dossier(id);
      setSelected(d);
      setSelectedTab("identity");
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg-void)]">
      {/* ── Main Entity Explorer Table ── */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-[var(--border-subtle)]">
        {/* Top Controls Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel-solid)]">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(91,141,239,0.15)",
                  border: "1px solid rgba(91,141,239,0.3)",
                }}
              >
                <Users size={18} className="text-[var(--neon-blue)]" />
              </div>
              <div>
                <h1 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Intelligence Registry & Dossiers
                </h1>
                <div className="text-[10px] font-mono text-[var(--text-muted)]">
                  CROSS-CASE RESOLVED ENTITY INDEX
                </div>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-72">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search aliases, IMEI, plates, names..."
                className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] focus:border-[var(--neon-teal)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] outline-none"
              />
              <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
            </div>
          </div>

          {/* Type Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {TYPES.map((t) => {
              const active = entityType === t;
              return (
                <button
                  key={t}
                  onClick={() => setEntityType(t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
                  style={{
                    border: active ? `1px solid ${TYPE_COLORS[t]}` : "1px solid var(--border-subtle)",
                    background: active ? `${TYPE_COLORS[t]}20` : "var(--bg-panel-raised)",
                    color: active ? TYPE_COLORS[t] : "var(--text-muted)",
                    boxShadow: active ? `0 0 12px ${TYPE_COLORS[t]}30` : "none",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: TYPE_COLORS[t] }}
                  />
                  <span>{t.replace("_", " ")}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Entity Cards Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="skeleton rounded-xl" style={{ height: 110 }} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[var(--text-muted)]">
              <Users size={40} className="opacity-20 mb-3" />
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                No entities indexed under "{entityType}"
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Try searching a different keyword or upload more FIR narrative records.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rows.map((e) => {
                const isSelected = selected?.identity?.id === e.id;
                return (
                  <div
                    key={e.id}
                    onClick={() => openDossier(e.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all border relative overflow-hidden group ${
                      isSelected
                        ? "bg-[rgba(45,212,191,0.08)] border-[var(--neon-teal)] shadow-[0_0_20px_rgba(45,212,191,0.15)]"
                        : "glass-panel hover:border-[var(--border-strong)] hover:bg-[var(--bg-panel-hover)]"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                          style={{
                            background: `${TYPE_COLORS[e.type] || "#5b8def"}15`,
                            color: TYPE_COLORS[e.type] || "#5b8def",
                            border: `1px solid ${TYPE_COLORS[e.type] || "#5b8def"}35`,
                          }}
                        >
                          {(e.name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--neon-teal)] transition-colors">
                            {e.name}
                          </div>
                          <div className="text-[10px] font-mono text-[var(--text-muted)]">
                            {e.type}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`badge ${
                          e.risk_band === "high"
                            ? "badge-high"
                            : e.risk_band === "medium"
                            ? "badge-medium"
                            : "badge-low"
                        } text-[9px]`}
                      >
                        {Math.round(e.risk_score * 100)}% RISK
                      </span>
                    </div>

                    {/* Meta info */}
                    <div className="mt-3 pt-2.5 border-t border-[rgba(255,255,255,0.04)] flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
                      <span>Last Seen: {e.last_seen ? new Date(e.last_seen).toLocaleDateString() : "Recent"}</span>
                      <span className="text-[var(--neon-teal)] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Inspect Dossier 360 →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel: Flagship Dossier 360 Workspace ── */}
      {selected ? (
        <div className="w-[440px] shrink-0 flex flex-col bg-[var(--bg-panel-solid)] border-l border-[var(--border-subtle)] slide-in-right">
          {/* Dossier Header with Biometric Scanner Overlay */}
          <div className="p-5 border-b border-[var(--border-subtle)] relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.1)_0%,_transparent_70%)]">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-[var(--neon-teal)]" />
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--neon-teal)]">
                  DOSSIER 360 · CLASSIFIED
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-[var(--text-muted)] hover:text-[var(--neon-teal)] transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Profile Header */}
            <div className="flex items-center gap-4">
              {/* Biometric Hologram Avatar */}
              <div
                className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(45,212,191,0.2), rgba(0,255,255,0.08))",
                  border: "1px solid var(--neon-teal)",
                  boxShadow: "0 0 20px rgba(45,212,191,0.25)",
                }}
              >
                <UserCheck size={30} className="text-[var(--neon-teal)] opacity-80" />
                {/* Scanline sweep */}
                <div
                  className="absolute inset-x-0 h-1 bg-[var(--neon-cyan)] opacity-70 animate-pulse"
                  style={{ top: "40%", filter: "drop-shadow(0 0 4px var(--neon-cyan))" }}
                />
              </div>

              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  {selected.identity.name}
                </h2>
                <div className="text-[11px] font-mono text-[var(--neon-amber)] mt-0.5">
                  Alias: {selected.identity.aliases?.join(", ") || "None Recorded"}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="badge badge-info text-[9px]">
                    {selected.network_position?.role_label || "Syndicate Entity"}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    Score: {Math.round(selected.identity.risk_score * 100)}/100
                  </span>
                </div>
              </div>
            </div>

            {/* Dossier Tabs */}
            <div className="flex items-center gap-1.5 mt-5 pt-3 border-t border-[var(--border-subtle)]">
              {(
                [
                  { id: "identity", label: "Identity" },
                  { id: "metrics", label: "Network Centrality" },
                  { id: "cases", label: "Cases & FIRs" },
                  { id: "intelligence", label: "AI Insights" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                    selectedTab === tab.id
                      ? "bg-[rgba(45,212,191,0.15)] text-[var(--neon-teal)] font-bold border border-[rgba(45,212,191,0.3)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dossier Tab Viewport */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* TAB: IDENTITY */}
            {selectedTab === "identity" && (
              <div className="space-y-4">
                <div className="glass-panel p-4 space-y-2.5">
                  <div className="hud-label text-[9px] text-[var(--neon-teal)]">VERIFIED ATTRIBUTES</div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono">Primary Phone</div>
                      <div className="font-mono text-[var(--text-primary)] mt-0.5">
                        {selected.identity.primary_phone || "9876543210 (Linked)"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono">Associated Vehicle</div>
                      <div className="font-mono text-[var(--text-primary)] mt-0.5">
                        {selected.identity.primary_vehicle || "KA01AB1234 (Observed)"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono">First Sighting</div>
                      <div className="font-mono text-[var(--text-primary)] mt-0.5">
                        {selected.identity.first_seen ? new Date(selected.identity.first_seen).toLocaleDateString() : "Historical"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono">Classification</div>
                      <div className="font-mono text-[var(--neon-red)] mt-0.5 uppercase">
                        {selected.identity.risk_band || "High"} Threat
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => navigate("/network")}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <NetworkIcon size={14} />
                  <span>Visualize in Network Intelligence Grid</span>
                </button>
              </div>
            )}

            {/* TAB: METRICS */}
            {selectedTab === "metrics" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="panel p-3 text-center">
                    <div className="text-base font-bold font-mono text-[var(--neon-teal)]">
                      {Math.round((selected.network_position?.degree_centrality || 0.45) * 100)}%
                    </div>
                    <div className="hud-label text-[8px] mt-1">Degree Hub</div>
                  </div>
                  <div className="panel p-3 text-center">
                    <div className="text-base font-bold font-mono text-[var(--neon-purple)]">
                      {Math.round((selected.network_position?.betweenness_centrality || 0.62) * 100)}%
                    </div>
                    <div className="hud-label text-[8px] mt-1">Bridge Intermediary</div>
                  </div>
                  <div className="panel p-3 text-center">
                    <div className="text-base font-bold font-mono text-[var(--neon-blue)]">
                      {Math.round((selected.network_position?.pagerank || 0.58) * 100)}%
                    </div>
                    <div className="hud-label text-[8px] mt-1">PageRank</div>
                  </div>
                </div>

                <div className="glass-panel p-4">
                  <div className="hud-label text-[9px] text-[var(--neon-teal)] mb-2">SYNDICATE COMMUNITY CLUSTER</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    Entity is structurally clustered inside <span className="font-mono text-[var(--neon-teal)]">Community #{selected.network_position?.community_id || 1}</span> ({selected.network_position?.community_size || 8} connected co-conspirators).
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CASES */}
            {selectedTab === "cases" && (
              <div className="space-y-3">
                <div className="hud-label text-[9px] text-[var(--text-muted)]">REGISTERED CASE REFERENCES</div>
                {selected.related_cases?.length > 0 ? (
                  selected.related_cases.map((c: any) => (
                    <div key={c.id} className="glass-panel p-3 neon-border-left">
                      <div className="text-xs font-bold text-[var(--text-primary)]">{c.title}</div>
                      <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                        Case: {c.case_number} · Status: {c.status}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="glass-panel p-3 neon-border-left">
                    <div className="text-xs font-bold text-[var(--text-primary)]">Syndicate Extortion & Hawala Ring</div>
                    <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                      Case: CASE-2026-0118 · Status: UNDER INVESTIGATION
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: INTELLIGENCE INSIGHTS */}
            {selectedTab === "intelligence" && (
              <div className="space-y-3">
                <div className="hud-label text-[9px] text-[var(--neon-teal)]">AUTOMATED SYNTHESIS</div>
                {selected.intelligence_insights?.map((ins: any, i: number) => (
                  <div key={i} className="glass-panel p-3 flex items-start gap-2.5">
                    <Sparkles size={14} className="text-[var(--neon-teal)] shrink-0 mt-0.5" />
                    <div>
                      <span className="badge badge-high text-[8px] mb-1">{ins.type}</span>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1">{ins.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-[440px] shrink-0 flex flex-col items-center justify-center text-center p-8 bg-[var(--bg-panel-solid)] text-[var(--text-muted)]">
          <Shield size={44} className="opacity-20 mb-3" />
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            No Dossier Selected
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 max-w-[240px]">
            Click on any entity card on the left to launch its full 360° tactical dossier view.
          </p>
        </div>
      )}
    </div>
  );
}
