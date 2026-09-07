import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { locationService } from "../services/locationService";
import IndiaGeoMap from "../components/IndiaGeoMap";
import type {
  LocationRecord,
  Hotspot,
  LocationDossier,
  LocationSummary,
} from "../types/location";
import {
  MapPin,
  Search,
  FolderKanban,
  RefreshCw,
  Clock,
  ShieldCheck,
  ChevronRight,
  Flame,
  Activity,
  AlertTriangle,
  Globe,
  Radio,
} from "lucide-react";

type TimeRange = "ALL" | "7D" | "30D" | "6M" | "1Y";

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

const KNOWN_CRIME_TYPES = [
  "ALL",
  "extortion",
  "smuggling",
  "narcotics trafficking",
  "robbery",
  "cybercrime",
  "money laundering",
];

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

function computeClientHotspots(
  locs: LocationRecord[],
  clusterRadiusKm = 40.0
): Hotspot[] {
  const valid = locs.filter(
    (l) => l.latitude != null && l.longitude != null && !isNaN(l.latitude) && !isNaN(l.longitude)
  );
  if (valid.length === 0) return [];

  const sorted = [...valid].sort(
    (a, b) => b.fir_count - a.fir_count || b.threat_score - a.threat_score || a.name.localeCompare(b.name)
  );

  const clusters: Hotspot[] = [];
  const assigned = new Set<string>();

  for (const seed of sorted) {
    if (assigned.has(seed.id)) continue;

    const members: LocationRecord[] = [seed];
    assigned.add(seed.id);

    for (const other of sorted) {
      if (assigned.has(other.id)) continue;

      // Haversine distance
      const R = 6371;
      const dLat = ((other.latitude! - seed.latitude!) * Math.PI) / 180;
      const dLon = ((other.longitude! - seed.longitude!) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((seed.latitude! * Math.PI) / 180) *
          Math.cos((other.latitude! * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = R * c;

      if (dist <= clusterRadiusKm) {
        members.push(other);
        assigned.add(other.id);
      }
    }

    const totalEvents = members.reduce((sum, m) => sum + (m.fir_count || 0), 0);
    const primaryDistrict = seed.district || "Central";
    const state = seed.state || "Tamil Nadu";

    const weights = members.map((m) => Math.max(1, m.fir_count || 0));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const centroidLat =
      members.reduce((acc, m, i) => acc + m.latitude! * weights[i], 0) / totalWeight;
    const centroidLon =
      members.reduce((acc, m, i) => acc + m.longitude! * weights[i], 0) / totalWeight;

    const densityScore = Math.round((totalEvents * 1.5 + members.length * 2.0) * 100) / 100;
    const maxThreat = Math.max(...members.map((m) => m.threat_score || 0));

    let severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" = "LOW";
    if (totalEvents >= 8 || maxThreat >= 70) severity = "CRITICAL";
    else if (totalEvents >= 4 || maxThreat >= 40) severity = "HIGH";
    else if (totalEvents >= 2) severity = "MODERATE";

    clusters.push({
      id: `hotspot-${primaryDistrict.toLowerCase().replace(/\s+/g, "-")}-${clusters.length + 1}`,
      rank: 0,
      region: `${primaryDistrict} Corridor`,
      district: primaryDistrict,
      state,
      latitude: Math.round(centroidLat * 100000) / 100000,
      longitude: Math.round(centroidLon * 100000) / 100000,
      event_count: totalEvents,
      location_count: members.length,
      density_score: densityScore,
      threat_score: maxThreat,
      severity,
      location_ids: members.map((m) => m.id),
      locations: members.map((m) => ({
        id: m.id,
        name: m.name,
        district: m.district,
        fir_count: m.fir_count,
        threat_score: m.threat_score,
      })),
    });
  }

  clusters.sort(
    (a, b) => b.event_count - a.event_count || b.density_score - a.density_score || b.location_count - a.location_count
  );
  clusters.forEach((c, idx) => {
    c.rank = idx + 1;
  });

  return clusters;
}

export default function Locations() {
  const navigate = useNavigate();

  const [rawLocations, setRawLocations] = useState<LocationRecord[]>([]);
  const [backendHotspots, setBackendHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Cascading Filter Controls
  const [selectedState, setSelectedState] = useState<string>("Tamil Nadu");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [eventType, setEventType] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");

  // Selection state
  const [selectedLoc, setSelectedLoc] = useState<LocationRecord | null>(null);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LocationDossier | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadLocationsData = useCallback(() => {
    setLoading(true);
    setError(null);
    locationService
      .getLocations()
      .then((res) => {
        const list = res.locations || [];
        setRawLocations(list);
        setBackendHotspots(res.hotspots || []);
        if (list.length > 0 && !selectedLoc) {
          selectLocationRecord(list[0]);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load location intelligence records.");
        setLoading(false);
      });
  }, [selectedLoc]);

  useEffect(() => {
    loadLocationsData();
  }, [loadLocationsData]);

  function selectLocationRecord(loc: LocationRecord) {
    setSelectedLoc(loc);
    setSelectedHotspotId(null);
    setDetailLoading(true);
    locationService
      .getLocationDetail(loc.id)
      .then((res) => {
        setDetail(res.location);
        setDetailLoading(false);
      })
      .catch(() => {
        setDetail(null);
        setDetailLoading(false);
      });
  }

  function selectHotspotCluster(spot: Hotspot) {
    setSelectedHotspotId(spot.id);
    if (spot.district) {
      setSelectedDistrict(spot.district);
    }
    // Find the primary location in this hotspot if available
    const firstLoc = rawLocations.find((l) => spot.location_ids.includes(l.id));
    if (firstLoc) {
      selectLocationRecord(firstLoc);
    }
  }

  // Available districts based on selected state
  const availableDistricts = useMemo(() => {
    if (!selectedState) {
      return Array.from(new Set(rawLocations.map((l) => l.district))).sort();
    }
    return (
      STATE_DISTRICT_MAP[selectedState] ||
      Array.from(
        new Set(
          rawLocations
            .filter((l) => l.state?.toLowerCase() === selectedState.toLowerCase())
            .map((l) => l.district)
        )
      ).sort()
    );
  }, [selectedState, rawLocations]);

  // Compute timestamp cut-off for timeRange filter
  const timeCutoffDate = useMemo(() => {
    if (timeRange === "ALL") return null;
    const now = new Date();
    if (timeRange === "7D") now.setDate(now.getDate() - 7);
    else if (timeRange === "30D") now.setDate(now.getDate() - 30);
    else if (timeRange === "6M") now.setMonth(now.getMonth() - 6);
    else if (timeRange === "1Y") now.setFullYear(now.getFullYear() - 1);
    return now.toISOString();
  }, [timeRange]);

  // Filter locations deterministically
  const filteredLocations = useMemo(() => {
    return rawLocations.filter((l) => {
      // 1. State Filter
      if (selectedState && selectedState !== "ALL") {
        const stateName = l.state || "Tamil Nadu";
        if (stateName.toLowerCase() !== selectedState.toLowerCase()) {
          return false;
        }
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
        const matchState = (l.state || "").toLowerCase().includes(s);
        const matchFir = (l.recent_fir || "").toLowerCase().includes(s);
        if (!matchName && !matchDistrict && !matchState && !matchFir) return false;
      }

      // 4. Severity Filter
      if (severityFilter !== "ALL" && l.risk_category !== severityFilter) {
        return false;
      }

      // 5. Event Type Filter
      if (eventType !== "ALL") {
        const hasEventType = l.events?.some(
          (e) => (e.crime_type || "").toLowerCase() === eventType.toLowerCase()
        );
        if (!hasEventType) return false;
      }

      // 6. Time Range Filter
      if (timeCutoffDate) {
        const hasRecentEvent = l.events?.some(
          (e) => e.timestamp && e.timestamp >= timeCutoffDate
        );
        if (!hasRecentEvent && (!l.created_at || l.created_at < timeCutoffDate)) {
          return false;
        }
      }

      return true;
    });
  }, [
    rawLocations,
    selectedState,
    selectedDistrict,
    search,
    severityFilter,
    eventType,
    timeCutoffDate,
  ]);

  // Dynamically compute hotspots based on filtered active locations
  const activeHotspots = useMemo(() => {
    const isUnfiltered =
      (!selectedState || selectedState === "Tamil Nadu") &&
      !selectedDistrict &&
      eventType === "ALL" &&
      severityFilter === "ALL" &&
      timeRange === "ALL" &&
      !search.trim();

    if (isUnfiltered && backendHotspots.length > 0) {
      return backendHotspots;
    }

    return computeClientHotspots(filteredLocations);
  }, [filteredLocations, backendHotspots, selectedState, selectedDistrict, eventType, severityFilter, timeRange, search]);

  // Unified Summary Statistics (Step 7)
  const summaryStats: LocationSummary = useMemo(() => {
    const totalEvents = filteredLocations.reduce((acc, l) => acc + (l.fir_count || 0), 0);
    const activeLocations = filteredLocations.filter(
      (l) => l.latitude != null && l.longitude != null
    ).length;
    const hotspotsCount = activeHotspots.length;
    const statesAffected = new Set(filteredLocations.map((l) => l.state || "Tamil Nadu")).size;
    const highestActivityRegion =
      activeHotspots.length > 0
        ? activeHotspots[0].region
        : filteredLocations.length > 0
        ? `${filteredLocations[0].district} Zone`
        : "None";

    return {
      totalEvents,
      activeLocations,
      hotspots: hotspotsCount,
      statesAffected,
      highestActivityRegion,
    };
  }, [filteredLocations, activeHotspots]);

  function handleResetFilters() {
    setSelectedState("");
    setSelectedDistrict("");
    setEventType("ALL");
    setSeverityFilter("ALL");
    setTimeRange("ALL");
    setSearch("");
    setSelectedLoc(null);
    setSelectedHotspotId(null);
  }

  return (
    <div className="flex flex-col h-full bg-[#020617] text-slate-100 overflow-hidden">
      {/* ── Top Header Strip ── */}
      <div className="px-6 py-3.5 border-b border-slate-800/90 space-y-2.5 bg-slate-900/95 backdrop-blur-md shadow-md shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge badge-info text-xs font-mono tracking-wider font-bold py-0.5 px-2 bg-slate-800 text-sky-300 border border-sky-500/30">
              LOCATION INTELLIGENCE & CRIME HOTSPOT RADAR
            </span>
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE TELEMETRY
            </span>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Active Territorial Records: <span className="text-white font-bold">{filteredLocations.length}</span> Verified Nodes
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-sky-400 border border-slate-800 flex items-center justify-center shadow-md">
              <MapPin size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase">
                  Location Intelligence
                </h1>
                <span className="badge badge-low text-[10px] bg-sky-950/80 text-sky-300 border border-sky-800/60 font-mono font-bold">
                  INDIA JURISDICTION MAP
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Geographic crime event distribution, deterministic hotspot clustering, and jurisdiction dossier correlation
              </p>
            </div>
          </div>

          {/* Quick Search & Reset Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-64 md:w-72 flex items-center">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search state, district, or node..."
                style={{ paddingLeft: "2.3rem" }}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl py-1.5 text-xs font-mono outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white text-xs font-mono font-semibold shadow-sm cursor-pointer transition-colors"
              title="Reset map filters to All India"
            >
              Reset Filters
            </button>

            <button
              onClick={loadLocationsData}
              title="Refresh location telemetry"
              className="p-2 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white bg-slate-950 transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-sky-400" : ""} />
            </button>
          </div>
        </div>

        {/* ── Filter Bar (Step 6) ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-1 border-t border-slate-800/60">
          {/* 1. Time Window */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold flex items-center gap-1">
              <Clock size={10} className="text-sky-400" />
              <span>Time Window</span>
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="workstation-input text-xs w-full py-1 bg-slate-950 border-slate-800 text-slate-200 font-mono rounded-lg"
            >
              <option value="ALL">All Time</option>
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
              <option value="6M">Last 6 Months</option>
              <option value="1Y">Last 1 Year</option>
            </select>
          </div>

          {/* 2. State Jurisdiction */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold flex items-center gap-1">
              <Globe size={10} className="text-sky-400" />
              <span>State Jurisdiction</span>
            </label>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict("");
                setSelectedLoc(null);
                setSelectedHotspotId(null);
              }}
              className="workstation-input text-xs w-full py-1 bg-slate-950 border-slate-800 text-slate-200 font-mono rounded-lg"
            >
              <option value="">All India</option>
              {ALL_INDIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state} {state === "Tamil Nadu" ? "(Active Records)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 3. District Sub-Division */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold flex items-center gap-1">
              <MapPin size={10} className="text-sky-400" />
              <span>District Jurisdiction</span>
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setSelectedLoc(null);
                setSelectedHotspotId(null);
              }}
              className="workstation-input text-xs w-full py-1 bg-slate-950 border-slate-800 text-slate-200 font-mono rounded-lg"
            >
              <option value="">All Districts ({availableDistricts.length})</option>
              {availableDistricts.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Event / Incident Type */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold flex items-center gap-1">
              <Activity size={10} className="text-sky-400" />
              <span>Incident Type</span>
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="workstation-input text-xs w-full py-1 bg-slate-950 border-slate-800 text-slate-200 font-mono rounded-lg"
            >
              {KNOWN_CRIME_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "ALL" ? "All Event Types" : t.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Severity Filter */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold flex items-center gap-1">
              <AlertTriangle size={10} className="text-sky-400" />
              <span>Activity Severity</span>
            </label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="workstation-input text-xs w-full py-1 bg-slate-950 border-slate-800 text-slate-200 font-mono rounded-lg"
            >
              <option value="ALL">All Threat Levels</option>
              <option value="CRITICAL">Critical (Threat 70%+)</option>
              <option value="HIGH">High (Threat 40-69%)</option>
              <option value="MODERATE">Moderate</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error state if API fails */}
      {error && (
        <div className="p-3 bg-red-950/80 border-b border-red-500/50 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadLocationsData}
            className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 rounded border border-red-500/40 text-[11px] font-mono cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ── Main Layout: Map (Top/Center) + Telemetry Strip + Bottom Intelligence Workspace ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Interactive India Map Container (Step 3, 4, 5) */}
        <div className="h-[420px] md:h-[480px] shrink-0 relative bg-[#070b14] border-b border-slate-800">
          <IndiaGeoMap
            locations={filteredLocations}
            hotspots={activeHotspots}
            selectedLocationId={selectedLoc?.id}
            selectedHotspotId={selectedHotspotId}
            selectedState={selectedState}
            selectedDistrict={selectedDistrict}
            onSelectLocation={selectLocationRecord}
            onSelectHotspot={selectHotspotCluster}
            onSelectState={setSelectedState}
            onSelectDistrict={setSelectedDistrict}
            onResetView={handleResetFilters}
          />
        </div>

        {/* ── Compact Intelligence Telemetry Summary Strip (Step 7) ── */}
        <div className="px-6 py-3 bg-slate-950/90 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center shrink-0">
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
            <div className="text-xs font-mono text-slate-400 uppercase font-bold flex items-center justify-center gap-1">
              <Activity size={12} className="text-sky-400" />
              <span>Total Events</span>
            </div>
            <div className="text-xl md:text-2xl font-black font-mono text-sky-400 mt-1">
              {summaryStats.totalEvents}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
            <div className="text-xs font-mono text-slate-400 uppercase font-bold flex items-center justify-center gap-1">
              <MapPin size={12} className="text-amber-400" />
              <span>Active Locations</span>
            </div>
            <div className="text-xl md:text-2xl font-black font-mono text-amber-400 mt-1">
              {summaryStats.activeLocations}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
            <div className="text-xs font-mono text-slate-400 uppercase font-bold flex items-center justify-center gap-1">
              <Flame size={12} className="text-red-400" />
              <span>Hotspots Identified</span>
            </div>
            <div className="text-xl md:text-2xl font-black font-mono text-red-400 mt-1">
              {summaryStats.hotspots}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
            <div className="text-xs font-mono text-slate-400 uppercase font-bold flex items-center justify-center gap-1">
              <Globe size={12} className="text-emerald-400" />
              <span>States Affected</span>
            </div>
            <div className="text-xl md:text-2xl font-black font-mono text-emerald-400 mt-1">
              {summaryStats.statesAffected}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm col-span-2 sm:col-span-1">
            <div className="text-xs font-mono text-slate-400 uppercase font-bold flex items-center justify-center gap-1">
              <Radio size={12} className="text-purple-400" />
              <span>Top Activity Region</span>
            </div>
            <div className="text-sm md:text-base font-bold font-mono text-purple-300 truncate mt-1.5" title={summaryStats.highestActivityRegion}>
              {summaryStats.highestActivityRegion}
            </div>
          </div>
        </div>

        {/* ── Bottom Section: Ranked Hotspot List (Left) + Selected Location Dossier (Right) ── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 bg-[#020617]">
          {/* Left Column: Ranked Hotspots Panel (Step 8) */}
          <div className="lg:col-span-5 border-r border-slate-800 flex flex-col min-h-[360px] bg-slate-900/60">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <Flame size={15} className="text-red-400" />
                <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-200">
                  Identified Crime Hotspots
                </span>
              </div>
              <span className="text-xs font-mono text-sky-400 font-semibold">
                {activeHotspots.length} CLUSTERS
              </span>
            </div>

            <div className="p-3 space-y-2 flex-1 overflow-y-auto">
              {loading ? (
                [1, 2, 3].map((n) => (
                  <div key={n} className="h-16 rounded-lg bg-slate-800/40 animate-pulse" />
                ))
              ) : activeHotspots.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-500 space-y-2">
                  <MapPin size={30} className="mx-auto opacity-30" />
                  <div className="font-semibold text-slate-400">No geographic events match the selected filters.</div>
                  <div className="text-xs text-slate-500 max-w-xs mx-auto">
                    {selectedState && selectedState !== "Tamil Nadu"
                      ? `No active cases mapped in ${selectedState} for current dataset.`
                      : "Try clearing search or broadening date/type filters."}
                  </div>
                  <button
                    onClick={handleResetFilters}
                    className="mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-sky-400 rounded-lg cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                activeHotspots.map((spot) => {
                  const isSelected = selectedHotspotId === spot.id;
                  const isCritical = spot.severity === "CRITICAL";
                  const isHigh = spot.severity === "HIGH";

                  return (
                    <div
                      key={spot.id}
                      onClick={() => selectHotspotCluster(spot)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-sky-500 bg-sky-950/40 shadow-md shadow-sky-500/10"
                          : "border-slate-800/80 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/90"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-[10px] font-mono font-bold text-sky-400">
                            #{spot.rank}
                          </span>
                          <span className="text-sm font-bold text-slate-100">{spot.region}</span>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                            isCritical
                              ? "bg-red-950/80 text-red-300 border border-red-800/60"
                              : isHigh
                              ? "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                              : "bg-sky-950/80 text-sky-300 border border-sky-800/60"
                          }`}
                        >
                          {spot.severity} DENSITY
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                        <span>
                          {spot.district}, {spot.state}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-semibold">{spot.event_count} Incidents</span>
                          <span>·</span>
                          <span>{spot.location_count} Nodes</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Location Detail / Dossier Panel (Step 9) */}
          <div className="lg:col-span-7 flex flex-col min-h-[360px] bg-slate-950/40">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-sky-400" />
                <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-200">
                  {selectedLoc ? "Location Activity Dossier" : "Geographic Overview"}
                </span>
              </div>

              {selectedLoc && (
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded uppercase ${
                    selectedLoc.threat_score >= 70
                      ? "bg-red-950 text-red-300 border border-red-800"
                      : selectedLoc.threat_score >= 40
                      ? "bg-amber-950 text-amber-300 border border-amber-800"
                      : "bg-sky-950 text-sky-300 border border-sky-800"
                  }`}
                >
                  {selectedLoc.threat_score >= 70
                    ? "Critical Threat"
                    : selectedLoc.threat_score >= 40
                    ? "High Threat"
                    : "Standard Threat"}
                </span>
              )}
            </div>

            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              {!selectedLoc ? (
                /* No Single Location Selected: Regional Overview */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <div className="text-xs font-mono text-sky-400 font-bold uppercase">
                      ADMINISTRATIVE JURISDICTION
                    </div>
                    <div className="text-base md:text-lg font-bold text-white">
                      {selectedDistrict
                        ? `${selectedDistrict} District Jurisdiction`
                        : selectedState
                        ? `${selectedState} State Intelligence Feed`
                        : "India National Incident Overview"}
                    </div>
                    <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                      Incident correlation across verified police station complaints, surveillance sightings, and registered case FIRs.
                      Select an incident marker on the map or click a ranked hotspot to inspect linked investigative files.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="text-2xl font-black font-mono text-sky-400">
                        {summaryStats.activeLocations}
                      </div>
                      <div className="text-xs font-mono text-slate-400 uppercase font-semibold mt-1">
                        Active Node Coordinates
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="text-2xl font-black font-mono text-amber-400">
                        {summaryStats.totalEvents}
                      </div>
                      <div className="text-xs font-mono text-slate-400 uppercase font-semibold mt-1">
                        Registered Case FIRs
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 space-y-2">
                    <div className="font-bold text-slate-200 uppercase tracking-wider">Tactical Guidance:</div>
                    <div>• Click any marker on the map to display its verified FIRs and accused entities.</div>
                    <div>• Click any ranked hotspot cluster to focus map coordinates on high density corridors.</div>
                    <div>• Use the Time Window filter to isolate recent operational movements.</div>
                  </div>
                </div>
              ) : (
                /* Selected Location Dossier (Step 9) */
                <div className="space-y-4">
                  {/* Location Header Card */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-sky-400 font-bold uppercase tracking-wider">
                        {selectedLoc.district} DISTRICT · {selectedLoc.state}
                      </span>
                      <span className="text-xs font-mono text-slate-400">ID: {selectedLoc.id.slice(0, 8)}</span>
                    </div>

                    <h2 className="text-lg md:text-xl font-bold text-white">{selectedLoc.name}</h2>

                    <div className="text-xs font-mono text-slate-300 flex items-center justify-between pt-1">
                      <span>
                        COORDINATES:{" "}
                        {selectedLoc.latitude != null ? `${selectedLoc.latitude.toFixed(4)}° N` : "N/A"},{" "}
                        {selectedLoc.longitude != null ? `${selectedLoc.longitude.toFixed(4)}° E` : "N/A"}
                      </span>
                      <span className="text-amber-400 font-semibold">{selectedLoc.fir_count} Linked Incidents</span>
                    </div>
                  </div>

                  {/* Threat Index & Activity */}
                  <div className="grid grid-cols-2 gap-3 text-center text-xs font-mono">
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                      <div className="text-xl md:text-2xl font-black font-mono text-amber-400">
                        {selectedLoc.threat_score}%
                      </div>
                      <div className="text-xs font-mono text-slate-400 uppercase font-semibold mt-1">
                        Activity Index
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                      <div className="text-xl md:text-2xl font-black font-mono text-sky-400">
                        {selectedLoc.fir_count}
                      </div>
                      <div className="text-xs font-mono text-slate-400 uppercase font-semibold mt-1">
                        FIR Complaints
                      </div>
                    </div>
                  </div>

                  {/* Event Timeline at Location (Step 9) */}
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-mono text-sky-400 font-bold uppercase flex items-center gap-1.5">
                        <Clock size={13} />
                        <span>Incident Timeline ({detail?.firs?.length || selectedLoc.fir_count})</span>
                      </div>
                      {detailLoading && <RefreshCw size={12} className="animate-spin text-sky-400" />}
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {detail?.event_timeline && detail.event_timeline.length > 0 ? (
                        detail.event_timeline.map((evt) => (
                          <div
                            key={evt.id}
                            className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between text-slate-200 font-mono font-bold">
                              <span>{evt.fir_number}</span>
                              <span className="badge badge-low text-[10px] uppercase">{evt.crime_type || "Incident"}</span>
                            </div>
                            {evt.case_number && (
                              <div className="text-[11px] font-mono text-sky-300">
                                Case: {evt.case_number} {evt.case_title ? `— ${evt.case_title}` : ""}
                              </div>
                            )}
                            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                              {evt.description || (evt as any).narrative}
                            </p>
                            {evt.timestamp && (
                              <div className="text-[10px] font-mono text-slate-500">
                                Date: {new Date(evt.timestamp).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400 py-3 text-center">
                          {selectedLoc.fir_count > 0
                            ? `Recorded ${selectedLoc.fir_count} case incident(s) at this coordinate.`
                            : "No registered FIR complaints logged for this coordinate."}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Related Cases (Step 9) */}
                  {detail?.related_cases && detail.related_cases.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                      <div className="text-xs font-mono text-sky-400 font-bold uppercase flex items-center gap-1.5">
                        <FolderKanban size={13} />
                        <span>Associated Cases ({detail.related_cases.length})</span>
                      </div>

                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {detail.related_cases.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => navigate("/cases")}
                            className="p-2 rounded-lg bg-slate-950/70 hover:bg-slate-900 border border-slate-800 flex items-center justify-between cursor-pointer group transition-colors"
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-200 group-hover:text-sky-300 font-mono">
                                {c.case_number}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate max-w-xs">{c.title}</div>
                            </div>
                            <span className="text-[10px] font-mono uppercase text-slate-400 px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
                              {c.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Corroborated Entities (Step 9) */}
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                    <div className="text-xs font-mono text-slate-400 font-bold uppercase flex items-center gap-1.5">
                      <ShieldCheck size={13} />
                      <span>Corroborated Entities at Location</span>
                    </div>

                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {(detail?.linked_entities || selectedLoc.linked_entities)?.length ? (
                        (detail?.linked_entities || selectedLoc.linked_entities).map((e, idx) => (
                          <div
                            key={e.id || idx}
                            onClick={() => navigate("/entities")}
                            className="p-2 rounded-lg bg-slate-950/70 hover:bg-slate-900 border border-slate-800 flex items-center justify-between cursor-pointer group transition-colors"
                          >
                            <div className="truncate">
                              <span className="text-xs font-semibold text-slate-200 group-hover:text-sky-300">
                                {e.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono ml-2">
                                ({e.type})
                              </span>
                            </div>
                            <ChevronRight size={13} className="text-slate-500 group-hover:text-white shrink-0" />
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500 py-2 text-center">
                          No corroborated entities linked directly to this coordinate.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Navigation Pathways */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => navigate("/cases")}
                      className="btn-primary py-2 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer rounded-xl"
                    >
                      <FolderKanban size={14} />
                      <span>View Cases</span>
                    </button>

                    <button
                      onClick={() => navigate("/timeline")}
                      className="btn-ghost py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 text-slate-200 hover:text-white cursor-pointer rounded-xl"
                    >
                      <Clock size={14} />
                      <span>Timeline</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

