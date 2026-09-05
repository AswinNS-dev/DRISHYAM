import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  MapPin, Search, FolderKanban, Crosshair
} from "lucide-react";

export default function Locations() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLoc, setSelectedLoc] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

  function loadLocations() {
    setLoading(true);
    api.locations()
      .then((res) => {
        const list = res.locations || [];
        setLocations(list);
        if (list.length > 0 && !selectedLoc) {
          selectLocation(list[0]);
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
    api.locationDetail(loc.id)
      .then((res) => {
        setDetail(res.location);
      })
      .catch(() => setDetail(null));
  }

  const filteredLocations = locations.filter((l) =>
    !search ||
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.district?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[var(--bg-void)]">
      {/* ── Top Header Strip ── */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-panel-solid)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
            <MapPin size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold tracking-wide uppercase text-[var(--text-primary)]">
                Geographic Intelligence & Sector Hotspots
              </h1>
              <span className="badge badge-low text-[8px]">SECTOR INTELLIGENCE</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Multi-district jurisdiction correlation, crime density hotspots, and territorial presence
            </p>
          </div>
        </div>

        <div className="relative w-64">
          <Search size={12} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter sector or district..."
            className="workstation-input pl-7 text-xs"
          />
        </div>
      </div>

      {/* ── Main Layout: Hotspot List + Vector Sector Canvas + Location Dossier ── */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Side: Locations Directory */}
        <div className="w-76 shrink-0 border-r border-[var(--border-subtle)] flex flex-col min-h-0 bg-[var(--bg-panel-solid)]">
          <div className="p-3 border-b border-[var(--border-subtle)] flex items-center justify-between text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase">
            <span>Identified Sector Hotspots</span>
            <span className="text-[var(--intel-sky)]">{filteredLocations.length} LOCATIONS</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {loading ? (
              [1, 2, 3].map((n) => (
                <div key={n} className="skeleton h-16 rounded" />
              ))
            ) : filteredLocations.length === 0 ? (
              <div className="text-center py-10 text-xs text-[var(--text-muted)]">No locations found.</div>
            ) : (
              filteredLocations.map((loc) => (
                <div
                  key={loc.id}
                  onClick={() => selectLocation(loc)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedLoc?.id === loc.id
                      ? "border-[var(--intel-sky)] bg-[var(--bg-panel-raised)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-panel)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{loc.name}</span>
                    <span
                      className={`badge text-[8px] ${
                        loc.threat_score > 75 ? "badge-high" : loc.threat_score > 40 ? "badge-medium" : "badge-low"
                      }`}
                    >
                      {loc.threat_score}% RISK
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
                    <span>{loc.district} Sector</span>
                    <span className="text-[var(--status-warning)]">{loc.fir_count} Linked FIRs</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center: Tactical Vector Map Canvas */}
        <div className="flex-1 min-w-0 h-full relative bg-[var(--bg-void)] flex items-center justify-center p-6">
          <div className="w-full h-full max-w-2xl max-h-[500px] border border-[var(--border-subtle)] rounded-lg relative overflow-hidden bg-[var(--bg-panel-solid)] p-6 flex flex-col justify-between">
            {/* Map Header */}
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Crosshair size={14} className="text-[var(--intel-sky)]" />
                <span className="text-xs font-mono font-bold text-[var(--text-primary)] uppercase">
                  Jurisdiction Radar & Hotspot Distribution
                </span>
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                COORDINATES: 12.9716° N, 77.5946° E
              </span>
            </div>

            {/* Simulated Tactical Sector Map Grid */}
            <div className="relative flex-1 my-4 flex items-center justify-center">
              {/* Concentric Sector Rings */}
              <div className="absolute w-72 h-72 rounded-full border border-[var(--border-subtle)]" />
              <div className="absolute w-48 h-48 rounded-full border border-[var(--border-subtle)]" />
              <div className="absolute w-24 h-24 rounded-full border border-[var(--border-subtle)]" />
              <div className="absolute inset-x-0 h-px bg-[var(--border-subtle)]" />
              <div className="absolute inset-y-0 w-px bg-[var(--border-subtle)]" />

              {/* Hotspot Markers */}
              {locations.map((loc, i) => {
                const isSelected = selectedLoc?.id === loc.id;
                // Distribute around center
                const angle = (i / Math.max(1, locations.length)) * Math.PI * 2;
                const distance = 80 + (i % 3) * 35;
                const left = `calc(50% + ${Math.cos(angle) * distance}px)`;
                const top = `calc(50% + ${Math.sin(angle) * distance}px)`;

                return (
                  <div
                    key={loc.id}
                    onClick={() => selectLocation(loc)}
                    style={{ left, top }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-125 ${
                        isSelected
                          ? "bg-[#38bdf8] border-white scale-125 shadow-sm"
                          : loc.threat_score > 70
                          ? "bg-[var(--status-alert)] border-black"
                          : "bg-zinc-400 border-black"
                      }`}
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-[var(--bg-void)] border border-[var(--border-subtle)] text-[9px] font-mono text-[var(--text-primary)] whitespace-nowrap opacity-80 group-hover:opacity-100 pointer-events-none">
                      {loc.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Map Legend Footer */}
            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] pt-3 border-t border-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[var(--status-alert)]" /> Critical Hotspot
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-zinc-400" /> Standard Sector
                </span>
              </div>
              <span>STATE POLICE GEOGRAPHIC SURVEILLANCE</span>
            </div>
          </div>
        </div>

        {/* Right Side: Sector Dossier Inspector */}
        {selectedLoc && (
          <div className="w-88 shrink-0 border-l border-[var(--border-subtle)] flex flex-col min-h-0 bg-[var(--bg-panel-solid)] p-5 space-y-4">
            <div className="pb-3 border-b border-[var(--border-subtle)] space-y-1">
              <span className="badge badge-low text-[8px]">{selectedLoc.district} SECTOR</span>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">{selectedLoc.name}</h2>
              <div className="text-[10px] font-mono text-[var(--text-muted)]">
                ID: {selectedLoc.id}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] space-y-1.5">
                <div className="hud-label text-[9px] text-[var(--intel-sky)]">JURISDICTION ASSESSMENT</div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Threat Index:</span>
                  <span className="font-mono font-bold text-[var(--status-warning)]">{selectedLoc.threat_score}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Linked FIRs:</span>
                  <span className="font-mono">{selectedLoc.fir_count} Complaints</span>
                </div>
              </div>

              <div className="p-3 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] space-y-2">
                <div className="hud-label text-[9px] text-[var(--intel-sky)]">ASSOCIATED SYNDICATE ACTIVITY</div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {detail?.description || "Identified as recurring meeting corridor for extortion rings. Observed telephone pings correlate with Central Station case files."}
                </p>
              </div>

              <button
                onClick={() => navigate("/cases")}
                className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
              >
                <FolderKanban size={13} />
                <span>View Sector Cases</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
