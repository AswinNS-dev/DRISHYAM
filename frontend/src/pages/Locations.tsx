import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  MapPin, Shield, Search, ExternalLink,
  Crosshair, Users
} from "lucide-react";

export default function Locations() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLoc, setSelectedLoc] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function loadLocations() {
    setLoading(true);
    api.locations()
      .then((res) => {
        setLocations(res.locations || []);
        if (res.locations?.length > 0 && !selectedLoc) {
          selectLocation(res.locations[0]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadLocations();
  }, []);

  function selectLocation(loc: any) {
    setSelectedLoc(loc);
    setDetailLoading(true);
    api.locationDetail(loc.id)
      .then((res) => {
        setDetail(res.location);
        setDetailLoading(false);
      })
      .catch(() => setDetailLoading(false));
  }

  const filteredLocations = locations.filter((l) =>
    !search ||
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.district?.toLowerCase().includes(search.toLowerCase())
  );

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
            <MapPin size={18} color="var(--neon-teal)" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wide uppercase text-[var(--text-primary)]">
                Geo-Spatial Intelligence & Hotspots
              </h1>
              <span className="hud-label text-[9px] text-[var(--neon-teal)]">SECTOR MAP v2</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Multi-district geographic incident correlation, territorial presence & corridor hotspots
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search size={13} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter location or district..."
            className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)]"
          />
        </div>
      </div>

      {/* ── Main Layout: Tactical Vector Map + Locations List + Dossier ── */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Side: Locations List Directory */}
        <div className="w-80 shrink-0 border-r flex flex-col min-h-0 bg-[var(--bg-panel)]" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="p-3 border-b border-[var(--border-subtle)] flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] uppercase">
            <span>Identified Hotspots</span>
            <span className="font-mono text-[10px] text-[var(--neon-teal)]">{filteredLocations.length} LOCATIONS</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              [1, 2, 3, 4].map((n) => (
                <div key={n} className="h-20 rounded-lg bg-[rgba(255,255,255,0.03)] animate-pulse border border-[var(--border-subtle)]" />
              ))
            ) : filteredLocations.length === 0 ? (
              <div className="text-center py-10 text-xs text-[var(--text-muted)]">No locations found.</div>
            ) : (
              filteredLocations.map((loc) => (
                <div
                  key={loc.id}
                  onClick={() => selectLocation(loc)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedLoc?.id === loc.id
                      ? "border-[var(--neon-teal)] bg-[rgba(45,212,191,0.08)] shadow-[0_0_12px_rgba(45,212,191,0.15)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-panel-raised)] hover:border-[rgba(45,212,191,0.3)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{loc.name}</span>
                    <span
                      className={`badge text-[9px] ${
                        loc.risk_category === "CRITICAL"
                          ? "badge-critical"
                          : loc.risk_category === "HIGH"
                          ? "badge-high"
                          : "badge-medium"
                      }`}
                    >
                      {loc.threat_score}% THREAT
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span>{loc.district} District</span>
                    <span className="font-mono text-[var(--neon-amber)]">{loc.fir_count} FIRs</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center: Tactical Vector Map Canvas */}
        <div className="flex-1 min-w-0 h-full relative bg-[radial-gradient(ellipse_at_center,_#0c1524_0%,_#030712_100%)] flex flex-col items-center justify-center p-6 overflow-hidden">
          {/* Cyberpunk Grid Overlay */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(to right, rgba(45,212,191,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(45,212,191,0.1) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          {/* Compass / Tactical HUD overlay */}
          <div className="absolute top-4 left-4 p-2.5 rounded-lg bg-[rgba(10,14,24,0.8)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--neon-teal)] space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Crosshair size={12} />
              <span>METROPOLITAN SECTOR GRID 12.97° N / 77.59° E</span>
            </div>
            <div className="text-[var(--text-muted)]">PROJECTION: CYBERPUNK EPSG:3857</div>
          </div>

          {/* SVG Tactical Radar & Location Nodes */}
          <div className="relative w-full max-w-2xl aspect-[4/3] rounded-2xl border border-[var(--border-subtle)] bg-[rgba(5,9,18,0.7)] backdrop-blur-md overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)]">
            {/* Concentric Radar Rings */}
            <svg className="w-full h-full absolute inset-0 pointer-events-none opacity-40">
              <circle cx="50%" cy="50%" r="20%" fill="none" stroke="rgba(45,212,191,0.2)" strokeDasharray="3 3" />
              <circle cx="50%" cy="50%" r="38%" fill="none" stroke="rgba(45,212,191,0.2)" strokeDasharray="4 4" />
              <circle cx="50%" cy="50%" r="56%" fill="none" stroke="rgba(45,212,191,0.25)" />
              <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(45,212,191,0.15)" />
              <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(45,212,191,0.15)" />
            </svg>

            {/* Render Location Pins on Vector Grid */}
            {locations.map((loc, idx) => {
              // Map simulated coordinates to 15-85% viewport
              const x = 20 + ((idx * 23) % 65);
              const y = 25 + ((idx * 31) % 55);
              const isSel = selectedLoc?.id === loc.id;

              return (
                <div
                  key={loc.id}
                  onClick={() => selectLocation(loc)}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10"
                >
                  {/* Pulse Ring */}
                  {loc.threat_score >= 60 && (
                    <div
                      className="absolute -inset-2 rounded-full animate-ping opacity-40"
                      style={{
                        backgroundColor: loc.risk_category === "CRITICAL" ? "rgba(244,63,94,0.4)" : "rgba(245,158,11,0.4)",
                      }}
                    />
                  )}

                  {/* Pin Dot */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      isSel
                        ? "scale-125 ring-2 ring-white shadow-[0_0_15px_rgba(45,212,191,0.8)]"
                        : "group-hover:scale-110"
                    }`}
                    style={{
                      background:
                        loc.risk_category === "CRITICAL"
                          ? "linear-gradient(135deg, #f43f5e, #be123c)"
                          : loc.risk_category === "HIGH"
                          ? "linear-gradient(135deg, #f59e0b, #b45309)"
                          : "linear-gradient(135deg, #2dd4bf, #0f766e)",
                    }}
                  >
                    <MapPin size={12} className="text-white" />
                  </div>

                  {/* Name Label */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-7 px-2 py-0.5 rounded bg-[rgba(10,14,24,0.85)] border border-[var(--border-subtle)] text-[10px] font-mono text-white whitespace-nowrap shadow-lg group-hover:border-[var(--neon-teal)]">
                    {loc.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Selected Location Dossier */}
        {selectedLoc && (
          <div
            className="w-96 shrink-0 border-l flex flex-col min-h-0 glass-panel p-5 overflow-y-auto space-y-4"
            style={{ borderColor: "var(--border-subtle)", borderRadius: 0 }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <span className="text-[9px] font-mono uppercase text-[var(--neon-teal)]">LOCATION INTELLIGENCE</span>
                <h2 className="text-sm font-bold text-[var(--text-primary)] mt-0.5">{selectedLoc.name}</h2>
              </div>
              <span
                className={`badge text-[9px] ${
                  selectedLoc.risk_category === "CRITICAL"
                    ? "badge-critical"
                    : selectedLoc.risk_category === "HIGH"
                    ? "badge-high"
                    : "badge-medium"
                }`}
              >
                {selectedLoc.threat_score}% THREAT
              </span>
            </div>

            {/* Coordinates & District */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
              <div className="p-2 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
                <div className="text-[9px] text-[var(--text-muted)] uppercase">District</div>
                <div className="text-white font-bold mt-0.5">{selectedLoc.district}</div>
              </div>
              <div className="p-2 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)]">
                <div className="text-[9px] text-[var(--text-muted)] uppercase">FIRs Logged</div>
                <div className="text-[var(--neon-teal)] font-bold mt-0.5">{selectedLoc.fir_count} Cases</div>
              </div>
            </div>

            {/* Linked Suspects / Operatives */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--neon-teal)] mb-2 flex items-center gap-1.5">
                <Users size={12} /> Linked Operatives
              </div>
              {selectedLoc.linked_entities?.length ? (
                <div className="space-y-1.5">
                  {selectedLoc.linked_entities.map((e: any) => (
                    <div
                      key={e.id}
                      onClick={() => navigate("/entities")}
                      className="p-2 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-[var(--neon-teal)] cursor-pointer flex items-center justify-between text-xs"
                    >
                      <span className="text-[var(--text-primary)] font-medium">{e.name}</span>
                      <span className="badge badge-low text-[9px]">{e.type}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[var(--text-muted)] p-3 rounded-lg bg-[var(--bg-panel-raised)] text-center">
                  No individual suspects directly mapped to this zone yet.
                </div>
              )}
            </div>

            {/* Linked FIRs */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)] mb-2 flex items-center gap-1.5">
                <Shield size={12} /> Sector Police Reports
              </div>
              {detail?.firs?.length ? (
                <div className="space-y-2">
                  {detail.firs.map((f: any) => (
                    <div
                      key={f.id}
                      onClick={() => navigate("/firs")}
                      className="p-2.5 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-[var(--neon-teal)] cursor-pointer text-xs"
                    >
                      <div className="font-mono font-bold text-[var(--neon-teal)]">{f.fir_number}</div>
                      <div className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mt-1">
                        {f.narrative}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[var(--text-muted)] text-center py-2">
                  {detailLoading ? "Loading FIRs..." : "No detailed complaints indexed."}
                </div>
              )}
            </div>

            <button
              onClick={() => navigate("/network")}
              className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-[var(--neon-teal)] text-[#08211d] hover:shadow-[0_0_12px_rgba(45,212,191,0.3)] transition-all flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={13} />
              Open Spatial Graph in Network Engine
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
