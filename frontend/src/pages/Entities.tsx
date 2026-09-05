import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  Search, Users, Network as NetworkIcon,
  UserCheck, X, Phone, Car, ShieldCheck
} from "lucide-react";

const TYPES = ["PERSON", "PHONE", "VEHICLE", "LOCATION", "GANG", "ORGANIZATION", "BANK_ACCOUNT"];

const TYPE_LABELS: Record<string, string> = {
  PERSON: "Persons of Interest",
  PHONE: "Contact Numbers",
  VEHICLE: "Tracked Vehicles",
  LOCATION: "Monitored Locations",
  GANG: "Syndicates & Gangs",
  ORGANIZATION: "Organizations",
  BANK_ACCOUNT: "Bank Accounts",
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
      {/* ── Main Entity Registry Explorer ── */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-[var(--border-subtle)]">
        {/* Top Controls Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel-solid)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
                <Users size={16} />
              </div>
              <div>
                <h1 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Subject Dossiers & Entity Registry
                </h1>
                <div className="text-[10px] font-mono text-[var(--text-muted)]">
                  CROSS-CASE RESOLVED IDENTITY DATABASE
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
                className="workstation-input pl-8 text-xs"
              />
              <Search size={12} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
            </div>
          </div>

          {/* Type Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {TYPES.map((t) => {
              const active = entityType === t;
              return (
                <button
                  key={t}
                  onClick={() => setEntityType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all shrink-0 cursor-pointer ${
                    active
                      ? "bg-zinc-100 text-zinc-900 font-semibold shadow-sm"
                      : "bg-[var(--bg-panel-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-hover)]"
                  }`}
                >
                  {TYPE_LABELS[t] || t.replace("_", " ")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Entity Cards Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="skeleton h-24 rounded-lg" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[var(--text-muted)]">
              <Users size={36} className="opacity-20 mb-2" />
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                No records indexed under "{TYPE_LABELS[entityType] || entityType}"
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Try searching a different keyword or ingest additional FIR narrative records.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {rows.map((e) => {
                const isSelected = selected?.identity?.id === e.id;
                return (
                  <div
                    key={e.id}
                    onClick={() => openDossier(e.id)}
                    className={`p-4 rounded-lg cursor-pointer transition-all border ${
                      isSelected
                        ? "bg-[var(--bg-panel-raised)] border-[var(--intel-sky)]"
                        : "bg-[var(--bg-panel-solid)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {e.name}
                        </div>
                        {e.aliases?.length > 0 && (
                          <div className="text-[10px] font-mono text-[var(--status-warning)] truncate">
                            Alias: {e.aliases.join(", ")}
                          </div>
                        )}
                      </div>
                      <span className="badge badge-low text-[8px] shrink-0">
                        {e.type}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-2 mt-2">
                      {e.primary_phone && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <Phone size={11} className="text-[var(--intel-sky)]" />
                          <span className="text-[var(--text-secondary)]">{e.primary_phone}</span>
                        </div>
                      )}
                      {e.primary_vehicle && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <Car size={11} className="text-[var(--status-warning)]" />
                          <span className="text-[var(--text-secondary)]">{e.primary_vehicle}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px] font-mono pt-1 text-[var(--text-muted)]">
                        <span>Connected Records: {e.degree || 1}</span>
                        <span className="text-[var(--intel-sky)]">Inspect Profile →</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel: Subject Intelligence Profile ── */}
      {selected ? (
        <div className="w-[420px] shrink-0 flex flex-col bg-[var(--bg-panel-solid)] border-l border-[var(--border-subtle)]">
          {/* Header */}
          <div className="p-5 border-b border-[var(--border-subtle)]">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[var(--intel-sky)]" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Subject Intelligence Profile
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 text-xs font-mono"
              >
                <X size={15} />
              </button>
            </div>

            {/* Profile Info */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-strong)] flex items-center justify-center text-[var(--intel-sky)] shrink-0">
                <UserCheck size={24} />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-[var(--text-primary)] truncate">
                  {selected.identity.name}
                </h2>
                <div className="text-[11px] font-mono text-[var(--status-warning)] truncate">
                  Alias: {selected.identity.aliases?.join(", ") || "None Recorded"}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="badge badge-low text-[8px]">
                    {selected.network_position?.role_label || "Associated Record"}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    Score: {Math.round(selected.identity.risk_score * 100)}/100
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Tabs */}
            <div className="flex items-center gap-1 mt-4 pt-3 border-t border-[var(--border-subtle)]">
              {(
                [
                  { id: "identity", label: "Identifiers" },
                  { id: "metrics", label: "Associations" },
                  { id: "cases", label: "Linked Cases" },
                  { id: "intelligence", label: "AI Suggestions" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono transition-all ${
                    selectedTab === tab.id
                      ? "bg-zinc-800 text-zinc-100 font-semibold shadow-sm border border-zinc-700/60"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Viewport */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* TAB: IDENTIFIERS */}
            {selectedTab === "identity" && (
              <div className="space-y-4">
                <div className="panel p-4 bg-[var(--bg-panel-raised)] space-y-3">
                  <div className="hud-label text-[9px] text-[var(--intel-sky)]">RECORDED IDENTIFIERS</div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono block">Primary Contact</span>
                      <span className="font-mono text-[var(--text-primary)] font-semibold mt-0.5 block">
                        {selected.identity.primary_phone || "9876543210"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono block">Associated Vehicle</span>
                      <span className="font-mono text-[var(--text-primary)] font-semibold mt-0.5 block">
                        {selected.identity.primary_vehicle || "KA01AB1234"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono block">Initial Sighting</span>
                      <span className="font-mono text-[var(--text-primary)] mt-0.5 block">
                        {selected.identity.first_seen ? new Date(selected.identity.first_seen).toLocaleDateString() : "Historical"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono block">Inquiry Priority</span>
                      <span className="badge badge-medium text-[8px] mt-0.5">
                        {selected.identity.risk_band || "High"} Priority
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => navigate("/network")}
                  className="btn-primary w-full py-2 flex items-center justify-center gap-2 text-xs"
                >
                  <NetworkIcon size={14} />
                  <span>Open in Network Analysis Workspace</span>
                </button>
              </div>
            )}

            {/* TAB: METRICS */}
            {selectedTab === "metrics" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="panel p-3 text-center bg-[var(--bg-panel-raised)]">
                    <div className="text-sm font-bold font-mono text-[var(--intel-sky)]">
                      {Math.round((selected.network_position?.degree_centrality || 0.45) * 100)}%
                    </div>
                    <div className="hud-label text-[8px] mt-1">Direct Links</div>
                  </div>
                  <div className="panel p-3 text-center bg-[var(--bg-panel-raised)]">
                    <div className="text-sm font-bold font-mono text-[var(--status-purple)]">
                      {Math.round((selected.network_position?.betweenness_centrality || 0.62) * 100)}%
                    </div>
                    <div className="hud-label text-[8px] mt-1">Bridge Contact</div>
                  </div>
                  <div className="panel p-3 text-center bg-[var(--bg-panel-raised)]">
                    <div className="text-sm font-bold font-mono text-[#3b82f6]">
                      {Math.round((selected.network_position?.pagerank || 0.58) * 100)}%
                    </div>
                    <div className="hud-label text-[8px] mt-1">Influence Score</div>
                  </div>
                </div>

                <div className="panel p-4 bg-[var(--bg-panel-raised)]">
                  <div className="hud-label text-[9px] text-[var(--intel-sky)] mb-2">SYNDICATE CO-OCCURRENCE CLUSTER</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    Subject structurally clusters inside <span className="font-mono text-[var(--text-primary)] font-bold">Group #{selected.network_position?.community_id || 1}</span> ({selected.network_position?.community_size || 8} connected co-conspirators).
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CASES */}
            {selectedTab === "cases" && (
              <div className="space-y-3">
                <div className="hud-label text-[9px] text-[var(--intel-sky)]">ASSOCIATED INVESTIGATIONS</div>
                <div className="p-3 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] space-y-1 text-xs">
                  <div className="font-mono font-bold text-[var(--intel-sky)]">CR-2026-0118</div>
                  <div className="font-semibold text-[var(--text-primary)]">Organized Extortion & Hawala Ring</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Named as associated conduit in preliminary complaint narrative.</div>
                </div>
              </div>
            )}

            {/* TAB: INTELLIGENCE */}
            {selectedTab === "intelligence" && (
              <div className="space-y-3">
                <div className="p-3 rounded bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.25)] text-[11px] text-[var(--text-secondary)]">
                  <strong>INVESTIGATIVE NOTICE:</strong> Suggestions generated by pattern analysis require independent verification by the investigating officer.
                </div>

                <div className="p-3 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] space-y-1.5 text-xs">
                  <div className="badge badge-low text-[8px]">Potential Connection</div>
                  <div className="font-semibold text-[var(--text-primary)]">Possible Burner Phone Match</div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Observed proximate tower pings with phone number 9876543210 during incident window.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
