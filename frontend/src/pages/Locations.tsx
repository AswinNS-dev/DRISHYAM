import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import IndiaGeoMap, { type GeoLocation } from "../components/IndiaGeoMap";
import {
  MapPin,
  Search,
  FolderKanban,
  Filter,
  RefreshCw,
  Clock,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

type ActivityCategory =
  | "ALL"
  | "FIRS"
  | "COMMUNICATIONS"
  | "FINANCIAL"
  | "VEHICLES";

type TimeRange = "ALL" | "7D" | "30D" | "6M";

// Standard list of Indian States for dropdown selection
const ALL_INDIAN_STATES = [
  "Tamil Nadu",
  "Karnataka",
  "Maharashtra",
  "Delhi",
  "Telangana",
  "Andhra Pradesh",
  "Kerala",
  "Gujarat",
  "Uttar Pradesh",
  "West Bengal",
  "Rajasthan",
  "Madhya Pradesh",
  "Punjab",
  "Haryana",
  "Odisha",
  "Bihar",
  "Assam",
  "Jammu and Kashmir",
];

// District mappings for states
const STATE_DISTRICT_MAP: Record<string, string[]> = {
  "Tamil Nadu": [
    "Chengalpattu",
    "Chennai South",
    "Coimbatore",
    "Madurai",
    "Salem",
    "Trichy",
  ],
  Karnataka: [
    "Bengaluru Urban",
    "Bengaluru Rural",
    "Mysuru",
    "Mangaluru",
    "Hubballi",
    "Belagavi",
  ],
  Maharashtra: [
    "Mumbai City",
    "Mumbai Suburban",
    "Pune",
    "Thane",
    "Nagpur",
    "Nashik",
  ],
  Delhi: [
    "New Delhi",
    "Central Delhi",
    "South Delhi",
    "North Delhi",
    "East Delhi",
  ],
  Telangana: [
    "Hyderabad",
    "Cyberabad",
    "Warangal",
    "Nizamabad",
    "Karimnagar",
  ],
};

export default function Locations() {
  const navigate = useNavigate();

  const [rawLocations, setRawLocations] = useState<GeoLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Cascading Geographic & Activity Filters
  const [selectedState, setSelectedState] = useState<string>("Tamil Nadu");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [activityCategory, setActivityCategory] = useState<ActivityCategory>("ALL");
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");

  // Selection state
  const [selectedLoc, setSelectedLoc] = useState<GeoLocation | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function loadLocations() {
    setLoading(true);
    api.locations()
      .then((res) => {
        const list: GeoLocation[] = res.locations || [];
        setRawLocations(list);
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

  function selectLocation(loc: GeoLocation) {
    setSelectedLoc(loc);
    setDetailLoading(true);
    api.locationDetail(loc.id)
      .then((res) => {
        setDetail(res.location);
        setDetailLoading(false);
      })
      .catch(() => {
        setDetail(null);
        setDetailLoading(false);
      });
  }

  // Available districts based on selected state
  const availableDistricts = useMemo(() => {
    if (!selectedState) {
      // Gather all distinct districts present in raw data
      return Array.from(new Set(rawLocations.map((l) => l.district))).sort();
    }
    return STATE_DISTRICT_MAP[selectedState] || [];
  }, [selectedState, rawLocations]);

  // Unified Filtering Pipeline (single source of truth for Map, Lists, Stats, and Dossier)
  const filteredLocations = useMemo(() => {
    return rawLocations.filter((l) => {
      // 1. State Filter: All current dataset locations belong to Tamil Nadu
      if (selectedState && selectedState !== "Tamil Nadu") {
        return false;
      }

      // 2. District Filter
      if (selectedDistrict && l.district.toLowerCase() !== selectedDistrict.toLowerCase()) {
        return false;
      }

      // 3. Search query filter
      if (search.trim()) {
        const s = search.toLowerCase();
        const matchName = l.name.toLowerCase().includes(s);
        const matchDistrict = l.district.toLowerCase().includes(s);
        if (!matchName && !matchDistrict) return false;
      }

      // 4. Activity Category Filter
      if (activityCategory === "FIRS" && l.fir_count === 0) return false;
      if (activityCategory === "COMMUNICATIONS") {
        const hasPhone = l.linked_entities?.some((e) => e.type === "PHONE");
        if (!hasPhone) return false;
      }
      if (activityCategory === "FINANCIAL") {
        const hasFin = l.linked_entities?.some((e) => e.type === "BANK_ACCOUNT");
        if (!hasFin) return false;
      }
      if (activityCategory === "VEHICLES") {
        const hasVeh = l.linked_entities?.some((e) => e.type === "VEHICLE");
        if (!hasVeh) return false;
      }

      return true;
    });
  }, [rawLocations, selectedState, selectedDistrict, activityCategory, search]);

  // Unified Summary Statistics
  const summaryStats = useMemo(() => {
    const totalLocations = filteredLocations.length;
    const totalFirs = filteredLocations.reduce((acc, l) => acc + (l.fir_count || 0), 0);
    const highActivityCount = filteredLocations.filter((l) => l.threat_score >= 70).length;
    const activeDistricts = new Set(filteredLocations.map((l) => l.district)).size;

    return { totalLocations, totalFirs, highActivityCount, activeDistricts };
  }, [filteredLocations]);

  // Handle Search Input matching State, District, or Location
  function handleSearchChange(val: string) {
    setSearch(val);
    if (!val.trim()) return;

    const query = val.trim().toLowerCase();

    // 1. Check if search matches an Indian State
    const matchedState = ALL_INDIAN_STATES.find(
      (s) => s.toLowerCase() === query || s.toLowerCase().startsWith(query)
    );
    if (matchedState) {
      setSelectedState(matchedState);
      setSelectedDistrict("");
      setSelectedLoc(null);
      return;
    }

    // 2. Check if search matches a District
    const allDistricts = Object.values(STATE_DISTRICT_MAP).flat();
    const matchedDistrict = allDistricts.find(
      (d) => d.toLowerCase() === query || d.toLowerCase().startsWith(query)
    );
    if (matchedDistrict) {
      // Find which state this district belongs to
      for (const [st, dists] of Object.entries(STATE_DISTRICT_MAP)) {
        if (dists.includes(matchedDistrict)) {
          setSelectedState(st);
          break;
        }
      }
      setSelectedDistrict(matchedDistrict);
      setSelectedLoc(null);
      return;
    }

    // 3. Check if search matches a specific location
    const matchedLoc = rawLocations.find((l) =>
      l.name.toLowerCase().includes(query)
    );
    if (matchedLoc) {
      setSelectedLoc(matchedLoc);
      selectLocation(matchedLoc);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#020617]">
      {/* ── Top Header Strip ── */}
      <div className="px-5 py-3 border-b border-slate-800/90 space-y-3 bg-slate-900/95 backdrop-blur-md shadow-md">
        {/* Module Metadata Line */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge badge-info text-[10px] font-mono tracking-wider font-bold py-0.5 px-2 bg-slate-800 text-sky-300 border border-sky-500/30 text-glow-sky">
              STATE GEOGRAPHIC INTELLIGENCE & JURISDICTION MAP
            </span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 text-glow-emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE DATABASE SYNCHRONIZED
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Active Scoped Jurisdictions: <span className="text-white font-bold">{filteredLocations.length}</span> Territorial Nodes
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-sky-400 border border-slate-800 flex items-center justify-center shadow-md">
              <MapPin size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-black tracking-wide uppercase text-white text-glow-white">
                  Geographic Intelligence & Investigation Hotspots
                </h1>
                <span className="badge badge-low text-[8px] bg-sky-950/80 text-sky-300 border border-sky-800/60 font-mono">
                  INDIA ADMINISTRATIVE JURISDICTION
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Administrative polygon correlation, verified incident density, and territorial activity tracking
              </p>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative w-72 flex items-center">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
              />
              <input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search state, district, or location..."
                style={{ paddingLeft: "2.35rem" }}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl py-1.5 text-xs font-mono outline-none focus:border-sky-500"
              />
            </div>

            <button
              onClick={() => {
                setSelectedState("");
                setSelectedDistrict("");
                setSelectedLoc(null);
                setSearch("");
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white text-xs font-mono shadow-sm cursor-pointer"
              title="Reset map view to All India"
            >
              All India View
            </button>

            <button
              onClick={loadLocations}
              title="Refresh location telemetry"
              className="p-2 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white bg-slate-950 transition-all shadow-sm"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-sky-400" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Workspace ── */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Side: Geographic Filters & Hotspots Directory */}
        <div className="w-80 shrink-0 border-r border-slate-800/90 flex flex-col min-h-0 bg-slate-900/95">
          {/* Cascading Filter Controls */}
          <div className="p-3.5 border-b border-slate-800/80 bg-slate-950/60 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-300 uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <Filter size={12} className="text-sky-400" />
                <span>Geographic Scoping</span>
              </div>
              <span className="text-sky-300 text-glow-sky">{filteredLocations.length} LOCATIONS</span>
            </div>

            {/* State Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">State Jurisdiction</label>
              <select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setSelectedDistrict("");
                  setSelectedLoc(null);
                }}
                className="workstation-input text-xs w-full py-1.5 bg-slate-900 border-slate-700/80 text-slate-200"
              >
                <option value="">All India</option>
                {ALL_INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state} {state === "Tamil Nadu" ? "(Active Records)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* District Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase">District Sub-Division</label>
              <select
                value={selectedDistrict}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value);
                  setSelectedLoc(null);
                }}
                className="workstation-input text-xs w-full py-1.5 bg-slate-900 border-slate-700/80 text-slate-200"
              >
                <option value="">All Districts ({availableDistricts.length})</option>
                {availableDistricts.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            </div>

            {/* Activity Category & Time Range Row */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-slate-400 uppercase">Activity Type</label>
                <select
                  value={activityCategory}
                  onChange={(e) => setActivityCategory(e.target.value as ActivityCategory)}
                  className="workstation-input text-[11px] w-full py-1 bg-slate-900 border-slate-700 text-slate-300"
                >
                  <option value="ALL">All Activity</option>
                  <option value="FIRS">Cases / FIRs</option>
                  <option value="COMMUNICATIONS">Communications</option>
                  <option value="FINANCIAL">Financial</option>
                  <option value="VEHICLES">Vehicles</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono text-slate-400 uppercase">Time Window</label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                  className="workstation-input text-[11px] w-full py-1 bg-slate-900 border-slate-700 text-slate-300"
                >
                  <option value="ALL">All Time</option>
                  <option value="7D">Last 7 Days</option>
                  <option value="30D">Last 30 Days</option>
                  <option value="6M">Last 6 Months</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick Metrics Summary */}
          <div className="p-3 border-b border-[var(--border-subtle)] grid grid-cols-2 gap-2 text-center bg-slate-900/20">
            <div className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="text-sm font-bold font-mono text-sky-400">{summaryStats.totalLocations}</div>
              <div className="text-[9px] font-mono text-slate-400 uppercase">Mapped Locations</div>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="text-sm font-bold font-mono text-amber-400">{summaryStats.totalFirs}</div>
              <div className="text-[9px] font-mono text-slate-400 uppercase">Linked FIRs</div>
            </div>
          </div>

          {/* Identified Hotspots List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {loading ? (
              [1, 2, 3, 4].map((n) => (
                <div key={n} className="skeleton h-14 rounded-lg bg-slate-800/50" />
              ))
            ) : filteredLocations.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 space-y-1">
                <MapPin size={24} className="mx-auto opacity-40 mb-2" />
                <div>No investigation activity recorded in this jurisdiction.</div>
                <div className="text-[10px] text-slate-600">
                  {selectedState && selectedState !== "Tamil Nadu"
                    ? `No active cases mapped in ${selectedState} for current dataset.`
                    : "Try broadening filters."}
                </div>
              </div>
            ) : (
              filteredLocations.map((loc) => {
                const isSelected = selectedLoc?.id === loc.id;
                const isHighActivity = loc.threat_score >= 70;
                const isModerate = loc.threat_score >= 40 && loc.threat_score < 70;

                return (
                  <div
                    key={loc.id}
                    onClick={() => selectLocation(loc)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "border-sky-500 bg-sky-950/40 shadow-sm"
                        : "border-slate-800/80 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/90"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-slate-200 truncate">{loc.name}</span>
                      <span
                        className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                          isHighActivity
                            ? "bg-red-950/80 text-red-300 border border-red-800/60"
                            : isModerate
                            ? "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                            : "bg-sky-950/80 text-sky-300 border border-sky-800/60"
                        }`}
                      >
                        {loc.threat_score}% Activity
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>{loc.district}</span>
                      <span className="text-amber-400/90">{loc.fir_count} Linked FIRs</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center: Real Geographic Map of India with Real Administrative Boundary Polygons */}
        <div className="flex-1 min-w-0 h-full relative bg-[var(--bg-void)]">
          <IndiaGeoMap
            locations={filteredLocations}
            selectedLocationId={selectedLoc?.id}
            selectedState={selectedState}
            selectedDistrict={selectedDistrict}
            onSelectLocation={selectLocation}
            onSelectState={setSelectedState}
            onSelectDistrict={setSelectedDistrict}
            onResetView={() => {
              setSelectedState("");
              setSelectedDistrict("");
              setSelectedLoc(null);
            }}
          />
        </div>

        {/* Right Side: Geographic Intelligence Dossier */}
        <div className="w-88 shrink-0 border-l border-[var(--border-subtle)] flex flex-col min-h-0 bg-[var(--bg-panel-solid)] shadow-2xl">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between bg-slate-900/40">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-sky-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                {selectedLoc ? "Location Activity Dossier" : "Geographic Overview"}
              </span>
            </div>

            {selectedLoc && (
              <span
                className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                  selectedLoc.threat_score >= 70
                    ? "bg-red-950 text-red-300 border border-red-800"
                    : selectedLoc.threat_score >= 40
                    ? "bg-amber-950 text-amber-300 border border-amber-800"
                    : "bg-sky-950 text-sky-300 border border-sky-800"
                }`}
              >
                {selectedLoc.threat_score >= 70
                  ? "High Activity"
                  : selectedLoc.threat_score >= 40
                  ? "Moderate Activity"
                  : "Standard Activity"}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {!selectedLoc ? (
              /* State or General Overview when no single location is selected */
              <div className="space-y-4">
                <div className="panel p-3.5 bg-[var(--bg-panel-raised)] border border-slate-700/60 space-y-1.5">
                  <div className="hud-label text-[9px] text-sky-400">ADMINISTRATIVE JURISDICTION</div>
                  <div className="text-sm font-bold text-slate-200">
                    {selectedDistrict
                      ? `${selectedDistrict} District, ${selectedState || "Tamil Nadu"}`
                      : selectedState
                      ? `${selectedState}, India`
                      : "India National Overview"}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Jurisdiction tracking across active police station zones, registered complaint records,
                    and verified investigation activity.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="text-base font-bold text-sky-400">{summaryStats.totalLocations}</div>
                    <div className="text-[9px] text-slate-400 uppercase">Active Locations</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="text-base font-bold text-amber-400">{summaryStats.totalFirs}</div>
                    <div className="text-[9px] text-slate-400 uppercase">Total Linked FIRs</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300">Investigation Guidance:</div>
                  <div>• Click any state or district polygon on the map to zoom to its boundary.</div>
                  <div>• Click a location marker to inspect its verified FIR complaints.</div>
                </div>
              </div>
            ) : (
              /* Selected Hotspot Location Dossier */
              <div className="space-y-3.5">
                {/* Header Card */}
                <div className="panel p-3.5 bg-[var(--bg-panel-raised)] border border-slate-700/60 space-y-1.5">
                  <span className="text-[9px] font-mono text-sky-400 font-bold uppercase tracking-wider">
                    {selectedLoc.district} DISTRICT JURISDICTION
                  </span>
                  <h2 className="text-sm font-bold text-slate-100">{selectedLoc.name}</h2>
                  <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
                    <span>
                      COORDS: {selectedLoc.latitude.toFixed(4)}° N, {selectedLoc.longitude.toFixed(4)}° E
                    </span>
                    <span>ID: {selectedLoc.id.slice(0, 8)}...</span>
                  </div>
                </div>

                {/* Threat & Activity Index */}
                <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="text-base font-bold text-amber-400">{selectedLoc.threat_score}%</div>
                    <div className="text-[9px] text-slate-400 uppercase">Activity Level</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <div className="text-base font-bold text-sky-400">{selectedLoc.fir_count}</div>
                    <div className="text-[9px] text-slate-400 uppercase">Linked FIRs</div>
                  </div>
                </div>

                {/* Linked FIR Complaints from Detail API */}
                <div className="panel p-3 bg-[var(--bg-panel-raised)] border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="hud-label text-[9px] text-sky-400">
                      REGISTERED FIR COMPLAINTS ({detail?.firs?.length || selectedLoc.fir_count})
                    </div>
                    {detailLoading && <RefreshCw size={11} className="animate-spin text-sky-400" />}
                  </div>

                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {detail?.firs && detail.firs.length > 0 ? (
                      detail.firs.map((fir: any) => (
                        <div
                          key={fir.id}
                          className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-slate-200 font-bold text-[11px]">
                            <span>{fir.fir_number}</span>
                            <span className="badge badge-low text-[8px]">REGISTERED</span>
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                            {fir.narrative}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 py-2 text-center">
                        {selectedLoc.fir_count > 0
                          ? `Recorded ${selectedLoc.fir_count} case complaint(s) linked to this location.`
                          : "No formal complaints logged for this coordinate."}
                      </div>
                    )}
                  </div>
                </div>

                {/* Corroborated Linked Entities */}
                <div className="panel p-3 bg-[var(--bg-panel-raised)] border border-slate-700/60 space-y-2">
                  <div className="hud-label text-[9px] text-slate-400">
                    CORROBORATED ENTITIES AT LOCATION
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {detail?.linked_entities && detail.linked_entities.length > 0 ? (
                      detail.linked_entities.map((e: any, idx: number) => (
                        <div
                          key={e.id || idx}
                          onClick={() => navigate("/entities")}
                          className="p-1.5 rounded bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between text-xs cursor-pointer group transition-colors"
                        >
                          <div className="truncate">
                            <span className="font-semibold text-slate-200 group-hover:text-sky-300">
                              {e.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                              ({e.type})
                            </span>
                          </div>
                          <ChevronRight size={12} className="text-slate-500 group-hover:text-white shrink-0" />
                        </div>
                      ))
                    ) : selectedLoc.linked_entities && selectedLoc.linked_entities.length > 0 ? (
                      selectedLoc.linked_entities.map((e: any, idx: number) => (
                        <div
                          key={e.id || idx}
                          onClick={() => navigate("/entities")}
                          className="p-1.5 rounded bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between text-xs cursor-pointer group transition-colors"
                        >
                          <div className="truncate">
                            <span className="font-semibold text-slate-200 group-hover:text-sky-300">
                              {e.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                              ({e.type})
                            </span>
                          </div>
                          <ChevronRight size={12} className="text-slate-500 group-hover:text-white shrink-0" />
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 py-1 text-center">
                        No corroborated entities linked directly to this location.
                      </div>
                    )}
                  </div>
                </div>

                {/* Navigation Pathways */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => navigate("/cases")}
                    className="btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                  >
                    <FolderKanban size={13} />
                    <span>View Cases</span>
                  </button>

                  <button
                    onClick={() => navigate("/timeline")}
                    className="btn-ghost py-2 text-xs flex items-center justify-center gap-1.5 border border-slate-700/80 text-slate-200 hover:text-white"
                  >
                    <Clock size={13} />
                    <span>Timeline</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
