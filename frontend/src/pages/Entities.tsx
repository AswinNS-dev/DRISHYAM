import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Search, Users, ChevronRight, ExternalLink } from "lucide-react";

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
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.entities(entityType, q)
      .then((r) => setRows(r.entities))
      .finally(() => setLoading(false));
  }, [entityType, q]);

  async function openDossier(id: string) {
    const d = await api.dossier(id);
    setSelected(d);
  }

  return (
    <div className="p-6 flex gap-6 h-full min-h-0 page-enter">
      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(91,141,239,0.1)",
              boxShadow: "0 0 16px rgba(91,141,239,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Users size={18} color="#5b8def" />
            </div>
            <h1 className="text-lg font-bold">Entities</h1>
          </div>

          {/* Type chips */}
          <div className="flex gap-1.5 ml-auto">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setEntityType(t)}
                className="transition-all"
                style={{
                  padding: "5px 12px",
                  borderRadius: 7,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.03em",
                  cursor: "pointer",
                  border: entityType === t
                    ? `1px solid ${TYPE_COLORS[t]}55`
                    : "1px solid var(--border-subtle)",
                  background: entityType === t
                    ? `${TYPE_COLORS[t]}12`
                    : "transparent",
                  color: entityType === t ? TYPE_COLORS[t] : "var(--text-muted)",
                  boxShadow: entityType === t ? `0 0 10px ${TYPE_COLORS[t]}15` : "none",
                }}
              >
                {t.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-3" style={{ color: "var(--text-muted)" }} />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name..."
            className="input-cyber pl-9"
          />
        </div>

        {/* Table */}
        <div className="glass-panel flex-1 overflow-auto" style={{ borderRadius: 12 }}>
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Name</th>
                {entityType === "PERSON" && <th>Role</th>}
                {entityType === "PERSON" && <th>Risk</th>}
                {entityType === "PERSON" && <th>Aliases</th>}
                <th>Source</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: TYPE_COLORS[entityType] || "#8b96ac",
                        boxShadow: `0 0 6px ${TYPE_COLORS[entityType] || "#8b96ac"}50`,
                      }} />
                      <span className="font-medium">{r.name}</span>
                    </div>
                  </td>
                  {entityType === "PERSON" && (
                    <td><span className="capitalize text-[var(--text-secondary)]">{r.role}</span></td>
                  )}
                  {entityType === "PERSON" && (
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className={`glow-dot glow-dot-${
                          r.risk_band === "high" ? "red" : r.risk_band === "medium" ? "amber" : "teal"
                        }`} style={{ width: 6, height: 6 }} />
                        <span className="hud-label" style={{ fontSize: 9 }}>{r.risk_band}</span>
                      </div>
                    </td>
                  )}
                  {entityType === "PERSON" && (
                    <td>
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        {r.aliases?.join(", ") || "—"}
                      </span>
                    </td>
                  )}
                  <td><span className="badge badge-demo" style={{ fontSize: 9 }}>{r.data_source}</span></td>
                  <td className="text-right">
                    {entityType === "PERSON" ? (
                      <button onClick={() => openDossier(r.id)}
                        className="btn-ghost flex items-center gap-1"
                        style={{ padding: "4px 10px", fontSize: 11 }}>
                        Dossier <ChevronRight size={12} />
                      </button>
                    ) : (
                      <button onClick={() => navigate("/network")}
                        className="btn-ghost flex items-center gap-1"
                        style={{ padding: "4px 10px", fontSize: 11 }}>
                        Network <ExternalLink size={11} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" style={{ height: 40 }} />)}
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              No entities found.
            </div>
          )}
        </div>
      </div>

      {/* Dossier Side Panel */}
      {selected && (
        <div className="w-96 shrink-0 glass-panel p-5 overflow-auto slide-in-right">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="hud-label mb-1" style={{ fontSize: 9 }}>Entity Dossier</div>
              <div className="text-base font-bold">{selected.identity.name}</div>
            </div>
            <button onClick={() => setSelected(null)}
              className="btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }}>
              Close
            </button>
          </div>

          {/* Identity */}
          <div className="mb-4">
            <div className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
              Aliases: {selected.identity.aliases.join(", ") || "None"}
            </div>
            <div className="flex gap-2">
              <span className="badge badge-info">{selected.network_position.role_label}</span>
              {selected.identity.risk_band && selected.identity.risk_band !== "unknown" && (
                <span className={`badge badge-${selected.identity.risk_band}`}>
                  {selected.identity.risk_band} risk
                </span>
              )}
            </div>
          </div>

          {/* Network metrics */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Degree", val: (selected.network_position.degree_centrality * 100).toFixed(0) + "%" },
              { label: "Betweenness", val: (selected.network_position.betweenness_centrality * 100).toFixed(0) + "%" },
              { label: "Community", val: selected.network_position.community_size },
            ].map(({ label, val }) => (
              <div key={label} className="panel p-2.5 text-center">
                <div className="counter-value text-sm font-bold" style={{ color: "var(--neon-teal)" }}>
                  {val}
                </div>
                <div className="hud-label mt-0.5" style={{ fontSize: 8 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Insights */}
          <div className="mb-4">
            <div className="hud-label mb-2" style={{ fontSize: 9, color: "var(--neon-teal)" }}>
              Intelligence Insights
            </div>
            <div className="space-y-1.5">
              {selected.intelligence_insights.map((ins: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs"
                     style={{ color: "var(--text-secondary)" }}>
                  <span className={`badge badge-${ins.type === "ANOMALY" ? "high" : "low"}`}
                        style={{ fontSize: 8, padding: "1px 6px", marginTop: 1 }}>
                    {ins.type}
                  </span>
                  <span>{ins.text}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => navigate("/network")}
            className="btn-primary w-full flex items-center justify-center gap-2">
            <NetworkIcon size={14} /> Open in Network
          </button>
        </div>
      )}
    </div>
  );
}

// Import missing icon
import { Network as NetworkIcon } from "lucide-react";
