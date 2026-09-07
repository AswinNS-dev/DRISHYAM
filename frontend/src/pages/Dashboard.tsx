import { useEffect, useState, useRef, useMemo } from "react";
import { api } from "../lib/api";
import { useTheme } from "../store/theme";
import {
  ShieldAlert,
  Flame,
  Clock,
  MapPin,
  Layers,
  Calendar,
  Filter,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Activity,
  Building2,
  Briefcase,
  PieChart as PieIcon,
  ScatterChart as ScatterIcon,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";

/* ── Tabular counter hook for smooth data roll-up ── */
function useCounter(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(0);
  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);
  return value;
}

/* ── Compact Inline SVG Sparkline Component with Glow ── */
function Sparkline({
  data,
  color = "#38bdf8",
  height = 26,
  width = 72,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((d - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pointsStr = points.join(" ");
  const areaPoints = `${padding},${height} ` + pointsStr + ` ${width - padding},${height}`;
  const gradId = `sparkline-${color.replace(/[^a-zA-Z0-9]/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
  const filterId = `filter-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.5} />
          <stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </linearGradient>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor={color} floodOpacity="0.7" />
        </filter>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pointsStr}
        filter={`url(#${filterId})`}
      />
    </svg>
  );
}

// Category palette mapping with rich vibrant colors
const CATEGORY_PALETTE: Record<string, string> = {
  "Narcotics Trafficking": "#c084fc", // Radiant Violet
  "Robbery": "#fb923c",              // Vibrant Orange
  "Extortion": "#facc15",            // Radiant Gold
  "Cybercrime": "#22d3ee",           // Neon Cyan
  "Money Laundering": "#34d399",     // Emerald
  "Smuggling": "#f87171",            // Coral Red
  "Unclassified": "#94a3b8",         // Muted Slate
};

function getCategoryColor(cat: string): string {
  return CATEGORY_PALETTE[cat] || "#38bdf8";
}

// Vibrant district colors for scatter plot
const DISTRICT_COLORS: Record<string, string> = {
  "Chengalpattu": "#a855f7",   // Glowing Purple
  "Trichy": "#f43f5e",         // Radiant Rose
  "Chennai South": "#06b6d4",  // Glowing Cyan
  "Coimbatore": "#10b981",     // Radiant Emerald
  "Madurai": "#14b8a6",        // Glowing Teal
  "Salem": "#f59e0b",          // Glowing Amber
  "Unassigned": "#64748b",     // Slate
};

function getDistrictColor(dist: string): string {
  return DISTRICT_COLORS[dist] || "#38bdf8";
}

export default function Dashboard() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter State
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedCrimeType, setSelectedCrimeType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("");

  // Hover states for interactive matrix & heatmap
  const [hoveredHeatmapCell, setHoveredHeatmapCell] = useState<{
    day: string;
    slot: string;
    count: number;
    pct: number;
  } | null>(null);

  const [hoveredMatrixCell, setHoveredMatrixCell] = useState<{
    district: string;
    category: string;
    count: number;
    pct: number;
  } | null>(null);

  const [showThreatMethodology, setShowThreatMethodology] = useState<boolean>(false);

  // Load Intelligence Data from Backend
  function loadIntelligence() {
    setLoading(true);
    setError(null);

    const params: Record<string, string> = {};
    if (selectedDistrict) params.district = selectedDistrict;
    if (selectedCrimeType) params.crime_type = selectedCrimeType;
    if (selectedStatus) params.status = selectedStatus;
    if (selectedTimeRange) params.time_range = selectedTimeRange;

    api.dashboardIntelligence(params)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to connect to crime intelligence service");
        setLoading(false);
      });
  }

  useEffect(() => {
    loadIntelligence();
  }, [selectedDistrict, selectedCrimeType, selectedStatus, selectedTimeRange]);

  // Reset Filters
  function resetFilters() {
    setSelectedDistrict("");
    setSelectedCrimeType("");
    setSelectedStatus("");
    setSelectedTimeRange("");
  }

  const kpis = data?.kpis;
  const countCrimes = useCounter(kpis?.total_crimes || 0);
  const countActiveCases = useCounter(kpis?.active_cases || 0);
  const countReviewCases = useCounter(kpis?.under_review_cases || 0);
  const countResolvedCases = useCounter(kpis?.resolved_cases || 0);
  const countDistricts = useCounter(kpis?.districts_covered || 0);
  const countCategories = useCounter(kpis?.crime_categories_count || 0);

  // Dynamic Theme Styling Tokens with Higher Luminosity
  const cardBg = isDark
    ? "bg-slate-900/95 border-slate-800/90 text-slate-100 shadow-xl backdrop-blur-md"
    : "bg-white/95 border-slate-200/90 text-slate-900 shadow-sm";
  const subCardBg = isDark ? "bg-slate-950/80 border-slate-800" : "bg-slate-50/90 border-slate-200";
  const gridStroke = isDark ? "rgba(51, 65, 85, 0.4)" : "#e2e8f0";
  const axisColor = isDark ? "#94a3b8" : "#475569";
  const tooltipBg = isDark
    ? "p-3 rounded-xl bg-slate-950/98 border border-slate-700 shadow-2xl text-xs space-y-1 font-mono min-w-[160px] text-white"
    : "p-3 rounded-xl bg-white/98 border border-slate-300 shadow-xl text-xs space-y-1 font-mono min-w-[160px] text-slate-900";

  // Max value in temporal heatmap for color scaling
  const maxHeatmapCount = useMemo(() => {
    if (!data?.temporal_heatmap?.matrix) return 1;
    let maxVal = 1;
    for (const row of data.temporal_heatmap.matrix) {
      for (const val of row) {
        if (val > maxVal) maxVal = val;
      }
    }
    return maxVal;
  }, [data]);

  return (
    <div className={`dashboard-page p-4 md:p-5 space-y-4 page-enter max-w-[1600px] mx-auto font-sans transition-colors duration-200 ${isDark ? "text-slate-100" : "text-slate-900"}`}>
      {/* ── Top Header & State Intelligence Banner ── */}
      <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b pb-4 ${isDark ? "border-slate-800/80" : "border-slate-200"}`}>
        <div>
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <span className="badge badge-info text-[10px] font-mono tracking-wider font-bold py-0.5 px-2.5 bg-slate-800 text-sky-300 border border-sky-500/30 text-glow-sky">
              STATE CRIME INTELLIGENCE & ANALYTICS CENTER
            </span>
            <span className={`text-xs font-mono font-semibold flex items-center gap-1.5 ${isDark ? "text-emerald-400" : "text-emerald-700"} text-glow-emerald`}>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse inline-block shadow-[0_0_8px_#34d399]" />
              LIVE DATABASE SYNCHRONIZED
            </span>
            {data?.metadata?.last_updated && (
              <span className={`text-xs font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                · Refreshed: {new Date(data.metadata.last_updated).toLocaleTimeString()}
              </span>
            )}
          </div>
          <h1 className={`text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
            <span>Crime Intelligence Overview</span>
          </h1>
          <p className={`text-xs md:text-sm mt-1 max-w-3xl leading-relaxed font-medium ${isDark ? "text-slate-200" : "text-slate-700"}`}>
            High-level analytical dashboard aggregating statutory FIR records, temporal incident density, district crime burden, and case disposition pipeline.
          </p>
        </div>

        {/* Action Controls & Real Theme Switcher */}
        <div className="flex items-center gap-2.5 shrink-0">
          {(selectedDistrict || selectedCrimeType || selectedStatus || selectedTimeRange) && (
            <button
              onClick={resetFilters}
              className={`text-xs px-3 py-1.5 rounded-lg font-mono font-bold transition-all border cursor-pointer ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 text-sky-300 border-slate-700 text-glow-sky"
                  : "bg-slate-100 hover:bg-slate-200 text-sky-700 border-slate-300"
              }`}
            >
              Reset Filters
            </button>
          )}

          <button
            onClick={loadIntelligence}
            className="btn-secondary flex items-center gap-2 text-xs py-1.5 px-3 font-semibold"
            title="Refresh database records"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-sky-400" : "text-sky-300"} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Compact Filter Bar ── */}
      <div className={`p-3 rounded-xl border backdrop-blur-md flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-md ${cardBg}`}>
        <div className="flex items-center gap-2 font-mono text-xs">
          <Filter size={14} className="text-sky-400" />
          <span className={`font-bold uppercase tracking-wider ${isDark ? "text-white text-glow-white" : "text-slate-800"}`}>
            Filter Scope:
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* District Filter */}
          <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 font-medium ${subCardBg}`}>
            <MapPin size={13} className="text-sky-400" />
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className={`bg-transparent text-xs font-semibold outline-none cursor-pointer ${isDark ? "text-slate-100" : "text-slate-900"}`}
            >
              <option value="" className={isDark ? "bg-slate-900" : "bg-white"}>All Districts (Statewide)</option>
              {data?.filter_options?.districts?.map((d: string) => (
                <option key={d} value={d} className={isDark ? "bg-slate-900" : "bg-white"}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Crime Category Filter */}
          <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 font-medium ${subCardBg}`}>
            <Layers size={13} className="text-purple-400" />
            <select
              value={selectedCrimeType}
              onChange={(e) => setSelectedCrimeType(e.target.value)}
              className={`bg-transparent text-xs font-semibold outline-none cursor-pointer ${isDark ? "text-slate-100" : "text-slate-900"}`}
            >
              <option value="" className={isDark ? "bg-slate-900" : "bg-white"}>All Crime Categories</option>
              {data?.filter_options?.categories?.map((c: string) => (
                <option key={c} value={c.toLowerCase()} className={isDark ? "bg-slate-900" : "bg-white"}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 font-medium ${subCardBg}`}>
            <Briefcase size={13} className="text-emerald-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={`bg-transparent text-xs font-semibold outline-none cursor-pointer ${isDark ? "text-slate-100" : "text-slate-900"}`}
            >
              <option value="" className={isDark ? "bg-slate-900" : "bg-white"}>All Investigation Statuses</option>
              <option value="open" className={isDark ? "bg-slate-900" : "bg-white"}>Active Inquiries (Open)</option>
              <option value="under_review" className={isDark ? "bg-slate-900" : "bg-white"}>Under Review</option>
              <option value="closed" className={isDark ? "bg-slate-900" : "bg-white"}>Resolved / Closed</option>
            </select>
          </div>

          {/* Time Range Filter */}
          <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 font-medium ${subCardBg}`}>
            <Calendar size={13} className="text-amber-400" />
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className={`bg-transparent text-xs font-semibold outline-none cursor-pointer ${isDark ? "text-slate-100" : "text-slate-900"}`}
            >
              <option value="" className={isDark ? "bg-slate-900" : "bg-white"}>All Historical Records</option>
              <option value="30d" className={isDark ? "bg-slate-900" : "bg-white"}>Last 30 Days</option>
              <option value="60d" className={isDark ? "bg-slate-900" : "bg-white"}>Last 60 Days</option>
              <option value="90d" className={isDark ? "bg-slate-900" : "bg-white"}>Last 90 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-700 text-xs text-rose-100 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle size={18} className="text-rose-400 shrink-0" />
            <span>Unable to load crime intelligence: {error}</span>
          </div>
          <button
            onClick={loadIntelligence}
            className="px-3 py-1 rounded bg-rose-900 hover:bg-rose-800 text-white font-mono text-xs font-bold cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ── Loading Skeleton ── */}
      {loading && !data ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-sky-400 border-t-transparent animate-spin shadow-[0_0_12px_#38bdf8]" />
          <div className="text-xs font-mono text-sky-300 uppercase tracking-wider font-bold text-glow-sky">
            Aggregating statutory crime intelligence data...
          </div>
        </div>
      ) : (
        <>
          {/* ═══════════════════════════════════════════════════════════════
              COMPACT KPI STRIP (6 Data-Backed Cards with Mini-Sparklines & Glow)
              ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* KPI 1: Total Statutory Crimes */}
            <div className={`p-3.5 rounded-xl border transition-all ${cardBg} hover:border-sky-500/70 hover:shadow-[0_0_16px_rgba(56,189,248,0.25)]`}>
              <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                <span>Total Crimes</span>
                <Flame size={15} className="text-sky-400" />
              </div>
              <div className="flex items-baseline justify-between mt-1.5">
                <div className="text-2xl md:text-3xl font-black font-mono text-white text-glow-white">
                  {countCrimes}
                </div>
                {data?.kpi_sparklines?.total_crimes && (
                  <Sparkline data={data.kpi_sparklines.total_crimes} color="#38bdf8" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs font-mono mt-1 font-semibold text-slate-200">
                <span className="truncate">Statutory FIRs</span>
                {data?.trend_percentage !== undefined && (
                  <span className={data.trend_percentage >= 0 ? "text-amber-400 font-bold flex items-center gap-0.5 text-glow-amber" : "text-emerald-400 font-bold flex items-center gap-0.5 text-glow-emerald"}>
                    {data.trend_percentage >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {data.trend_percentage >= 0 ? `+${data.trend_percentage}%` : `${data.trend_percentage}%`}
                  </span>
                )}
              </div>
            </div>

            {/* KPI 2: Active Inquiries */}
            <div className={`p-3.5 rounded-xl border transition-all ${cardBg} hover:border-amber-500/70 hover:shadow-[0_0_16px_rgba(245,158,11,0.25)]`}>
              <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                <span>Active Cases</span>
                <Clock size={15} className="text-amber-400" />
              </div>
              <div className="flex items-baseline justify-between mt-1.5">
                <div className="text-2xl md:text-3xl font-black font-mono text-amber-300 text-glow-amber">
                  {countActiveCases}
                </div>
                {data?.kpi_sparklines?.active_cases && (
                  <Sparkline data={data.kpi_sparklines.active_cases} color="#f59e0b" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs font-mono mt-1 font-semibold text-slate-200">
                <span className="truncate">Open Inquiries</span>
                <span className="text-amber-300 font-bold text-glow-amber">
                  {kpis?.total_cases ? Math.round((kpis.active_cases / kpis.total_cases) * 100) : 0}% load
                </span>
              </div>
            </div>

            {/* KPI 3: Under Review */}
            <div className={`p-3.5 rounded-xl border transition-all ${cardBg} hover:border-purple-500/70 hover:shadow-[0_0_16px_rgba(168,85,247,0.25)]`}>
              <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                <span>Under Review</span>
                <Activity size={15} className="text-purple-400" />
              </div>
              <div className="flex items-baseline justify-between mt-1.5">
                <div className="text-2xl md:text-3xl font-black font-mono text-purple-300 text-glow-purple">
                  {countReviewCases}
                </div>
                {data?.kpi_sparklines?.under_review_cases && (
                  <Sparkline data={data.kpi_sparklines.under_review_cases} color="#a855f7" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs font-mono mt-1 font-semibold text-slate-200">
                <span className="truncate">Evidence Audit</span>
                <span className="text-purple-300 font-bold text-glow-purple">
                  {kpis?.total_cases ? Math.round((kpis.under_review_cases / kpis.total_cases) * 100) : 0}% share
                </span>
              </div>
            </div>

            {/* KPI 4: Judicial Resolution */}
            <div className={`p-3.5 rounded-xl border transition-all ${cardBg} hover:border-emerald-500/70 hover:shadow-[0_0_16px_rgba(16,185,129,0.25)]`}>
              <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                <span>Resolved</span>
                <CheckCircle2 size={15} className="text-emerald-400" />
              </div>
              <div className="flex items-baseline justify-between mt-1.5">
                <div className="text-2xl md:text-3xl font-black font-mono text-emerald-300 text-glow-emerald">
                  {countResolvedCases}
                </div>
                {data?.kpi_sparklines?.resolved_cases && (
                  <Sparkline data={data.kpi_sparklines.resolved_cases} color="#10b981" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs font-mono mt-1 font-semibold text-slate-200">
                <span className="truncate">Disposed</span>
                <span className="text-emerald-300 font-bold text-glow-emerald">{kpis?.resolution_rate || 0}% rate</span>
              </div>
            </div>

            {/* KPI 5: Districts Covered */}
            <div className={`p-3.5 rounded-xl border transition-all ${cardBg} hover:border-cyan-500/70 hover:shadow-[0_0_16px_rgba(6,182,212,0.25)]`}>
              <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                <span>Districts</span>
                <Building2 size={15} className="text-cyan-400" />
              </div>
              <div className="flex items-baseline justify-between mt-1.5">
                <div className="text-2xl md:text-3xl font-black font-mono text-cyan-300 text-glow-cyan">
                  {countDistricts}
                </div>
                {data?.kpi_sparklines?.districts_covered && (
                  <Sparkline data={data.kpi_sparklines.districts_covered} color="#06b6d4" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs font-mono mt-1 font-semibold text-slate-200">
                <span className="truncate">Active Zones</span>
                <span className="text-cyan-300 font-bold text-glow-cyan">{data?.district_burden?.length || 0} active</span>
              </div>
            </div>

            {/* KPI 6: Emerging Offenses */}
            <div className={`p-3.5 rounded-xl border transition-all ${cardBg} hover:border-rose-500/70 hover:shadow-[0_0_16px_rgba(244,63,94,0.25)]`}>
              <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                <span>Categories</span>
                <Layers size={15} className="text-rose-400" />
              </div>
              <div className="flex items-baseline justify-between mt-1.5">
                <div className="text-2xl md:text-3xl font-black font-mono text-rose-300 text-glow-rose">
                  {countCategories}
                </div>
                {data?.kpi_sparklines?.emerging_offenses && (
                  <Sparkline data={data.kpi_sparklines.emerging_offenses} color="#f43f5e" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs font-mono mt-1 font-semibold text-slate-200">
                <span className="truncate">Top: {data?.emerging_patterns?.[0]?.category || "Narcotics"}</span>
                <span className="text-rose-300 font-bold text-glow-rose">
                  {data?.emerging_patterns?.filter((p: any) => p.momentum === "SURGE").length || 0} Surging
                </span>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              ROW 1: Crime Trend Intelligence + Crime Category Donut
              ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-12 gap-2.5">
            {/* VISUALIZATION 1: Crime Trend Intelligence (Col 8) */}
            <div className={`col-span-12 lg:col-span-8 p-4 rounded-xl border flex flex-col justify-between ${cardBg}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b pb-3 mb-2" style={{ borderColor: gridStroke }}>
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-sky-400" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-white text-glow-sky">
                      Crime Trend Intelligence
                    </h2>
                    <span className="badge badge-info text-[10px] font-mono font-bold">
                      MONTHLY TIME-SERIES
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    Progression of statutory crime volume across active inquiries vs resolved cases
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block shadow-[0_0_8px_#38bdf8]" />
                    <span className="text-sky-300 text-glow-sky">Active Inquiries</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_#34d399]" />
                    <span className="text-emerald-300 text-glow-emerald">Resolved</span>
                  </div>
                </div>
              </div>

              {/* Chart Canvas */}
              <div className="h-56 w-full">
                {!data?.crime_trends || data.crime_trends.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs opacity-50 font-mono">
                    No historical trend records found for current scope
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.crime_trends} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.55} />
                          <stop offset="95%" stopColor="#00f0ff" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.55} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                        <filter id="chartGlow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#00f0ff" floodOpacity="0.7" />
                        </filter>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis
                        dataKey="month_label"
                        stroke={axisColor}
                        fontSize={11}
                        fontWeight={600}
                        tickLine={false}
                        axisLine={{ stroke: gridStroke }}
                      />
                      <YAxis
                        stroke={axisColor}
                        fontSize={11}
                        fontWeight={600}
                        tickLine={false}
                        axisLine={{ stroke: gridStroke }}
                        allowDecimals={false}
                      />
                      <RechartsTooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className={tooltipBg}>
                                <div className="font-bold pb-1 border-b text-sm text-white" style={{ borderColor: gridStroke }}>
                                  {label}
                                </div>
                                <div className="flex justify-between font-semibold">
                                  <span className="text-slate-300">Total Crimes:</span>
                                  <strong className="text-white">{p.total_crimes}</strong>
                                </div>
                                <div className="flex justify-between text-cyan-300 font-bold">
                                  <span>Active Inquiries:</span>
                                  <strong>{p.active_crimes}</strong>
                                </div>
                                <div className="flex justify-between text-emerald-300 font-bold">
                                  <span>Resolved:</span>
                                  <strong>{p.resolved_crimes}</strong>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="active_crimes"
                        name="Active Inquiries"
                        stroke="#00f0ff"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#activeGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="resolved_crimes"
                        name="Resolved"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#resolvedGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* VISUALIZATION 2: Crime Category Composition Donut (Col 4) */}
            <div className={`col-span-12 lg:col-span-4 p-4 rounded-xl border flex flex-col justify-between ${cardBg}`}>
              <div className="flex items-center justify-between border-b pb-3 mb-2" style={{ borderColor: gridStroke }}>
                <div className="flex items-center gap-2">
                  <PieIcon size={16} className="text-purple-400" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-white text-glow-purple">
                    Category Composition
                  </h2>
                </div>
                <span className="text-xs font-mono font-bold text-slate-300">
                  {data?.crime_categories?.length || 0} Categories
                </span>
              </div>

              {/* Donut Chart with Glowing Center Total */}
              <div className="relative h-44 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const p = payload[0].payload;
                          return (
                            <div className={tooltipBg}>
                              <div className="font-bold flex items-center gap-1.5 text-sm">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: getCategoryColor(p.category), boxShadow: `0 0 8px ${getCategoryColor(p.category)}` }} />
                                <span className="text-white">{p.category}</span>
                              </div>
                              <div className="flex justify-between pt-1 font-semibold">
                                <span className="text-slate-300">Incidents:</span>
                                <strong className="text-white">{p.count}</strong>
                              </div>
                              <div className="flex justify-between font-semibold">
                                <span className="text-slate-300">Share:</span>
                                <strong className="text-sky-300">{p.percentage}%</strong>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Pie
                      data={data?.crime_categories || []}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                      stroke={isDark ? "#0f172a" : "#ffffff"}
                      strokeWidth={2}
                    >
                      {data?.crime_categories?.map((entry: any) => (
                        <Cell key={`pie-cell-${entry.category}`} fill={getCategoryColor(entry.category)} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Label */}
                <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className={`text-2xl md:text-3xl font-black font-mono leading-none ${isDark ? "text-white text-glow-white" : "text-slate-900"}`}>
                    {kpis?.total_crimes || 0}
                  </span>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400 text-glow-sky mt-0.5">
                    CRIMES
                  </span>
                </div>
              </div>

              {/* Compact Category Slices List with Glowing Dots */}
              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t" style={{ borderColor: gridStroke }}>
                {data?.crime_categories?.slice(0, 4).map((c: any) => (
                  <div key={c.category} className="flex items-center justify-between text-xs font-mono px-1 font-semibold">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getCategoryColor(c.category), boxShadow: `0 0 6px ${getCategoryColor(c.category)}` }} />
                      <span className="truncate text-slate-200">{c.category}</span>
                    </div>
                    <span className="font-bold shrink-0 text-white">{c.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              ROW 2: Historical Category Momentum Time-Series (12-Col)
              ═══════════════════════════════════════════════════════════════ */}
          <div className={`col-span-12 p-4 rounded-xl border ${cardBg}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 mb-2.5" style={{ borderColor: gridStroke }}>
              <div>
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-cyan-400" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-white text-glow-cyan">
                    Crime Category Evolution (Monthly Time-Series)
                  </h2>
                  <span className="badge badge-info text-[10px] font-mono font-bold">
                    MULTI-SERIES TRAJECTORY
                  </span>
                </div>
                <p className={`text-xs mt-0.5 font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  Tracking volume trajectories for each offense category across 6-month statutory filing history
                </p>
              </div>

              {/* Category Badges Legend */}
              <div className="flex items-center gap-2.5 flex-wrap text-xs font-mono font-semibold">
                {data?.category_names?.map((cat: string) => (
                  <div key={cat} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: getCategoryColor(cat), boxShadow: `0 0 6px ${getCategoryColor(cat)}` }} />
                    <span className="text-slate-200">{cat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Multi-Line Chart Canvas */}
            <div className="h-52 w-full">
              {!data?.category_trends || data.category_trends.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs opacity-50 font-mono">
                  No historical category trend data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.category_trends} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis
                      dataKey="month_label"
                      stroke={axisColor}
                      fontSize={11}
                      fontWeight={600}
                      tickLine={false}
                      axisLine={{ stroke: gridStroke }}
                    />
                    <YAxis
                      stroke={axisColor}
                      fontSize={11}
                      fontWeight={600}
                      tickLine={false}
                      axisLine={{ stroke: gridStroke }}
                      allowDecimals={false}
                    />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className={tooltipBg}>
                              <div className="font-bold pb-1 border-b text-sm text-white" style={{ borderColor: gridStroke }}>
                                {label}
                              </div>
                              {payload.map((entry: any) => (
                                <div key={entry.name} className="flex justify-between items-center gap-3 text-xs font-semibold">
                                  <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                                    <span className="w-2 h-2 rounded-full" style={{ background: entry.color, boxShadow: `0 0 6px ${entry.color}` }} />
                                    <span>{entry.name}:</span>
                                  </span>
                                  <strong className="text-right text-white">{entry.value}</strong>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {data.category_names?.map((cat: string) => (
                      <Line
                        key={`trend-line-${cat}`}
                        type="monotone"
                        dataKey={cat}
                        name={cat}
                        stroke={getCategoryColor(cat)}
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: getCategoryColor(cat), stroke: "#ffffff", strokeWidth: 1.5 }}
                        activeDot={{ r: 5.5, strokeWidth: 2 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              ROW 3: District Crime Burden + Investigation Status Pipeline
              ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-12 gap-2.5">
            {/* VISUALIZATION 4: District Crime Burden (Horizontal Bar Chart) (Col 6) */}
            <div className={`col-span-12 lg:col-span-6 p-4 rounded-xl border flex flex-col justify-between ${cardBg}`}>
              <div className="flex items-center justify-between border-b pb-2.5 mb-2" style={{ borderColor: gridStroke }}>
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-amber-400" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-white text-glow-amber">
                      District Crime Burden
                    </h2>
                  </div>
                  <p className={`text-xs mt-0.5 font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    Geographic volume ranking of crime incidents across active police districts
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-slate-300">
                  {data?.district_burden?.length || 0} Districts
                </span>
              </div>

              {/* Horizontal BarChart */}
              <div className="h-60 w-full">
                {!data?.district_burden || data.district_burden.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs opacity-50 font-mono">
                    No district records available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={data.district_burden}
                      margin={{ top: 5, right: 30, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                      <XAxis type="number" stroke={axisColor} fontSize={11} fontWeight={600} tickLine={false} axisLine={{ stroke: gridStroke }} />
                      <YAxis
                        type="category"
                        dataKey="district"
                        stroke={axisColor}
                        fontSize={11}
                        fontWeight={700}
                        tickLine={false}
                        axisLine={{ stroke: gridStroke }}
                        width={95}
                      />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className={tooltipBg}>
                                <div className="font-bold text-sky-400 text-sm border-b pb-1" style={{ borderColor: gridStroke }}>
                                  #{p.rank} {p.district}
                                </div>
                                <div className="flex justify-between font-semibold">
                                  <span className="text-slate-300">Recorded FIRs:</span>
                                  <strong className="text-white">{p.count}</strong>
                                </div>
                                <div className="flex justify-between font-semibold">
                                  <span className="text-slate-300">Statewide Share:</span>
                                  <strong className="text-sky-300">{p.percentage}%</strong>
                                </div>
                                <div className="flex justify-between text-amber-400 font-bold">
                                  <span>Active Inquiries:</span>
                                  <strong>{p.active_cases}</strong>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" fill="#38bdf8" radius={[0, 5, 5, 0]}>
                        {data.district_burden.map((_entry: any, index: number) => (
                          <Cell
                            key={`bar-${index}`}
                            fill={
                              index === 0 ? "#f59e0b" :
                              index === 1 ? "#38bdf8" :
                              index === 2 ? "#06b6d4" :
                              index === 3 ? "#10b981" :
                              index === 4 ? "#a855f7" : "#64748b"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Sub-strip of Top 3 districts with glowing text */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs font-mono" style={{ borderColor: gridStroke }}>
                {data?.district_burden?.slice(0, 3).map((d: any) => (
                  <div key={d.district} className={`p-2 rounded-lg border text-center ${subCardBg}`}>
                    <div className="font-bold truncate text-white">{d.district}</div>
                    <div className="text-sky-300 font-bold text-glow-sky">{d.count} crimes ({d.percentage}%)</div>
                  </div>
                ))}
              </div>
            </div>

            {/* VISUALIZATION 5: Investigation Status Pipeline (Funnel / Bar) (Col 6) */}
            <div className={`col-span-12 lg:col-span-6 p-4 rounded-xl border flex flex-col justify-between ${cardBg}`}>
              <div className="flex items-center justify-between border-b pb-2.5 mb-2" style={{ borderColor: gridStroke }}>
                <div>
                  <div className="flex items-center gap-2">
                    <Briefcase size={16} className="text-sky-400" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-white text-glow-sky">
                      Investigation Pipeline & Disposition
                    </h2>
                  </div>
                  <p className={`text-xs mt-0.5 font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    Case progression from registered inquiry to judicial disposition
                  </p>
                </div>
                <span className="badge badge-verified text-[10px] font-mono font-bold text-emerald-300 text-glow-emerald">
                  {kpis?.resolution_rate || 0}% Cleared
                </span>
              </div>

              {/* Pipeline Stage Cards with Glowing Highlights */}
              <div className="space-y-2 py-1">
                {data?.investigation_pipeline?.map((stage: any, idx: number) => {
                  let badgeColor = "bg-sky-500/20 text-sky-300 border-sky-500/50 text-glow-sky";
                  let barColor = "bg-gradient-to-r from-sky-400 to-cyan-400";
                  if (stage.status === "under_review") {
                    badgeColor = "bg-purple-500/20 text-purple-300 border-purple-500/50 text-glow-purple";
                    barColor = "bg-gradient-to-r from-purple-400 to-indigo-400";
                  } else if (stage.status === "closed") {
                    badgeColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 text-glow-emerald";
                    barColor = "bg-gradient-to-r from-emerald-400 to-teal-400";
                  }

                  return (
                    <div
                      key={stage.status}
                      className={`p-2.5 rounded-lg border space-y-1.5 transition-all ${subCardBg} hover:border-slate-700`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full text-xs font-mono flex items-center justify-center font-bold ${
                            isDark ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-800"
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-white">{stage.label}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-sm font-black text-white">{stage.count} Cases</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${badgeColor}`}>
                            {stage.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Progress bar with glow */}
                      <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${stage.percentage}%` }}
                        />
                      </div>

                      <div className={`text-xs leading-tight font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                        {stage.description}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Disposition Summary Indicator */}
              <div className="flex items-center justify-between text-xs font-mono pt-2 border-t font-semibold text-slate-200" style={{ borderColor: gridStroke }}>
                <span>Total Cases: <strong className="text-white">{kpis?.total_cases || 0}</strong></span>
                <span>Active Workload: <strong className="text-amber-300 text-glow-amber">{Math.round(((kpis?.active_cases || 0) + (kpis?.under_review_cases || 0)) / (kpis?.total_cases || 1) * 100)}%</strong></span>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              ROW 4: Temporal Crime Heatmap (Dense 7x8 Grid with Glowing Heat)
              ═══════════════════════════════════════════════════════════════ */}
          <div className={`col-span-12 p-4 rounded-xl border ${cardBg}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 mb-3" style={{ borderColor: gridStroke }}>
              <div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-sky-400" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-white text-glow-sky">
                    Temporal Incident Density (7 Days × 8 Time Blocks)
                  </h2>
                  <span className="badge badge-info text-[10px] font-mono font-bold">
                    FILING DENSITY
                  </span>
                </div>
                <p className={`text-xs mt-0.5 font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  Actual incident density mapped by day of the week and 3-hour statutory filing windows
                </p>
              </div>

              {/* Peak Activity Alert Pill with Vibrant Glow */}
              {data?.temporal_heatmap?.peak && (
                <div className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-2 ${
                  isDark ? "bg-amber-950/80 border-amber-400 text-amber-200 box-glow-amber text-glow-amber" : "bg-amber-100 border-amber-400 text-amber-900"
                }`}>
                  <Zap size={14} className="text-amber-300 shrink-0 animate-bounce" />
                  <span>Peak Density Window: <strong>{data.temporal_heatmap.peak.label}</strong></span>
                </div>
              )}
            </div>

            {/* Heatmap Matrix Table with Glowing Gradients */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse min-w-[650px]">
                <thead>
                  <tr>
                    <th className={`p-2 text-left text-xs font-bold w-20 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      DAY / HRS
                    </th>
                    {data?.temporal_heatmap?.time_slots?.map((slot: string) => (
                      <th key={slot} className={`p-2 text-center text-xs font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                        {slot}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.temporal_heatmap?.days?.map((day: string, dayIdx: number) => {
                    const row = data.temporal_heatmap.matrix[dayIdx] || [];
                    return (
                      <tr key={day} className="border-t" style={{ borderColor: gridStroke }}>
                        <td className={`p-2 font-bold text-xs ${isDark ? "text-white text-glow-white" : "text-slate-900"}`}>
                          {day.slice(0, 3)}
                        </td>
                        {row.map((val: number, slotIdx: number) => {
                          const slotName = data.temporal_heatmap.time_slots[slotIdx];
                          const total = data.temporal_heatmap.total_timestamped_crimes || 1;
                          const cellPct = Math.round((val / total) * 100);

                          // Vibrant Glowing Intensity Color Scale
                          let cellClass = isDark
                            ? "bg-slate-950/80 text-slate-500 border border-slate-800/80 hover:border-slate-500"
                            : "bg-slate-100 text-slate-400 hover:border-slate-300";
                          if (val > 0) {
                            const ratio = val / maxHeatmapCount;
                            if (ratio > 0.65) {
                              // PEAK (5+): Hot Amber / Flame Gradient with Intense Glow
                              cellClass = isDark
                                ? "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-slate-950 font-black border border-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.85)] scale-105"
                                : "bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 font-black border border-amber-500 shadow-md";
                            } else if (ratio > 0.35) {
                              // MEDIUM (3-4): Electric Sky / Indigo Gradient
                              cellClass = isDark
                                ? "bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-black border border-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.65)]"
                                : "bg-gradient-to-br from-sky-400 to-indigo-500 text-white font-bold shadow-sm";
                            } else {
                              // LOW (1-2): Radiant Electric Cyan / Teal with Glow
                              cellClass = isDark
                                ? "bg-cyan-950/90 text-cyan-300 font-bold border border-cyan-500/70 shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                                : "bg-cyan-100 text-cyan-800 font-bold border border-cyan-400";
                            }
                          }

                          return (
                            <td key={slotIdx} className="p-1 text-center">
                              <div
                                onMouseEnter={() =>
                                  setHoveredHeatmapCell({
                                    day,
                                    slot: slotName,
                                    count: val,
                                    pct: cellPct,
                                  })
                                }
                                onMouseLeave={() => setHoveredHeatmapCell(null)}
                                className={`h-8 rounded-lg flex items-center justify-center text-xs transition-all duration-200 cursor-pointer hover:scale-110 ${cellClass}`}
                                title={`${day} ${slotName}:00: ${val} crimes (${cellPct}%)`}
                              >
                                {val > 0 ? val : "·"}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Heatmap Footer Legend & Hover State */}
            <div className="flex items-center justify-between text-xs font-mono pt-2.5 border-t mt-2 font-semibold" style={{ borderColor: gridStroke }}>
              <div className="flex items-center gap-2">
                {hoveredHeatmapCell ? (
                  <span className="text-cyan-300 font-bold text-glow-cyan">
                    {hoveredHeatmapCell.day} @ {hoveredHeatmapCell.slot}:00 → {hoveredHeatmapCell.count} Incidents ({hoveredHeatmapCell.pct}% of statewide total)
                  </span>
                ) : (
                  <span className="text-slate-300">Hover any cell to inspect temporal density</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-300">Density Scale:</span>
                <span className={`px-2 py-0.5 rounded text-xs ${isDark ? "bg-slate-950 text-slate-500" : "bg-slate-100 text-slate-500"}`}>0</span>
                <span className="px-2 py-0.5 rounded text-xs bg-cyan-950 text-cyan-300 border border-cyan-500/60 font-bold">Low</span>
                <span className="px-2 py-0.5 rounded text-xs bg-sky-500 text-white font-bold shadow-[0_0_8px_#38bdf8]">Med</span>
                <span className="px-2 py-0.5 rounded text-xs bg-amber-400 text-slate-950 font-black shadow-[0_0_12px_#f59e0b]">Peak</span>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              ROW 5: Emerging Crime Patterns + Crime Threat Radar (Glowing)
              ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-12 gap-2.5">
            {/* VISUALIZATION 6: Emerging Crime Patterns (Velocity Momentum) (Col 6) */}
            <div className={`col-span-12 lg:col-span-6 p-4 rounded-xl border flex flex-col justify-between ${cardBg}`}>
              <div className="flex items-center justify-between border-b pb-2.5 mb-2" style={{ borderColor: gridStroke }}>
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-rose-400" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-white text-glow-rose">
                      Emerging Crime Patterns & Velocity
                    </h2>
                  </div>
                  <p className={`text-xs mt-0.5 font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    Period-over-period frequency momentum based on historical database records
                  </p>
                </div>
                <span className="badge badge-medium text-[10px] font-mono font-bold text-amber-300 text-glow-amber">
                  VELOCITY MOMENTUM
                </span>
              </div>

              {/* Emerging Cards with Glowing Badges */}
              <div className="space-y-2 py-1">
                {data?.emerging_patterns?.slice(0, 5).map((pat: any) => {
                  let momentumBadge = isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700";
                  if (pat.momentum === "SURGE") {
                    momentumBadge = isDark
                      ? "bg-rose-950 text-rose-300 border border-rose-500/80 text-glow-rose shadow-[0_0_8px_rgba(244,63,94,0.3)]"
                      : "bg-rose-100 text-rose-700 border border-rose-300";
                  } else if (pat.momentum === "ACCELERATING") {
                    momentumBadge = isDark
                      ? "bg-amber-950 text-amber-300 border border-amber-500/80 text-glow-amber shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                      : "bg-amber-100 text-amber-700 border border-amber-300";
                  } else if (pat.momentum === "DECLINING") {
                    momentumBadge = isDark
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-500/80 text-glow-emerald shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                      : "bg-emerald-100 text-emerald-700 border border-emerald-300";
                  }

                  return (
                    <div
                      key={pat.category}
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 transition-all ${subCardBg} hover:border-slate-700`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: getCategoryColor(pat.category), boxShadow: `0 0 8px ${getCategoryColor(pat.category)}` }}
                          />
                          <span className="text-xs font-bold text-white truncate">{pat.category}</span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${momentumBadge}`}>
                            {pat.momentum}
                          </span>
                        </div>
                        <div className={`text-xs font-mono font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                          Recent: <strong className="text-white">{pat.recent_count}</strong> vs Prior: <strong className="text-slate-400">{pat.prior_count}</strong>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`text-sm font-mono font-black ${
                          pat.growth_pct > 0 ? "text-rose-400 text-glow-rose" : pat.growth_pct < 0 ? "text-emerald-400 text-glow-emerald" : "text-slate-300"
                        }`}>
                          {pat.growth_pct >= 0 ? `+${pat.growth_pct}%` : `${pat.growth_pct}%`}
                        </div>
                        <div className="text-[10px] font-mono font-medium text-slate-400">Growth Rate</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-xs font-mono pt-2 border-t flex justify-between font-semibold text-slate-200" style={{ borderColor: gridStroke }}>
                <span>Surge Threshold: <strong className="text-rose-400">≥ +20.0%</strong></span>
                <span>Declining Threshold: <strong className="text-emerald-400">&lt; 0.0%</strong></span>
              </div>
            </div>

            {/* VISUALIZATION 7: Crime Threat Assessment (Glowing Neon Radar) (Col 6) */}
            <div className={`col-span-12 lg:col-span-6 p-4 rounded-xl border flex flex-col justify-between ${cardBg}`}>
              <div className="flex items-center justify-between border-b pb-2.5 mb-2" style={{ borderColor: gridStroke }}>
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={16} className="text-amber-400" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-white text-glow-amber">
                      Threat Dimension Assessment (Radar)
                    </h2>
                  </div>
                  <p className={`text-xs mt-0.5 font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    5-dimension normalized threat vector calculated from real database indicators
                  </p>
                </div>
                <button
                  onClick={() => setShowThreatMethodology(!showThreatMethodology)}
                  className="text-xs font-mono font-bold text-sky-400 hover:underline flex items-center gap-1 cursor-pointer text-glow-sky"
                >
                  <Info size={13} />
                  <span>Methodology</span>
                </button>
              </div>

              {showThreatMethodology && (
                <div className={`p-3 rounded-lg border text-xs space-y-1 font-mono mb-2 ${
                  isDark ? "bg-sky-950/60 border-sky-600 text-sky-200 box-glow-cyan" : "bg-sky-50 border-sky-300 text-sky-900"
                }`}>
                  <div className="font-bold text-xs text-white">RADAR SCORING FORMULATION:</div>
                  <p className="text-xs leading-relaxed text-slate-200">
                    {data?.threat_assessment?.methodology}
                  </p>
                </div>
              )}

              {/* Glowing Radar Chart & Composite Score Strip */}
              <div className="flex flex-col sm:flex-row items-center gap-3.5">
                {/* Recharts Neon Radar Chart */}
                <div className="h-56 w-full sm:w-3/5">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={data?.threat_radar || []} margin={{ top: 10, right: 25, left: 25, bottom: 10 }}>
                      <defs>
                        <radialGradient id="radarNeonGrad" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.65} />
                          <stop offset="85%" stopColor="#8b5cf6" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#00f0ff" stopOpacity={0.1} />
                        </radialGradient>
                      </defs>
                      <PolarGrid stroke="rgba(56, 189, 248, 0.3)" strokeDasharray="3 3" />
                      <PolarAngleAxis
                        dataKey="subject"
                        stroke="#38bdf8"
                        fontSize={11}
                        fontWeight={700}
                        tickLine={false}
                      />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke={axisColor} fontSize={9} />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className={tooltipBg}>
                                <div className="font-bold text-cyan-300 text-sm text-glow-cyan">{p.subject}</div>
                                <div className="flex justify-between font-semibold pt-0.5">
                                  <span className="text-slate-300">Score:</span>
                                  <strong className="text-white">{p.score}/100</strong>
                                </div>
                                <div className="flex justify-between text-xs text-slate-300 font-medium">
                                  <span>Metric:</span>
                                  <span className="text-white font-bold">{p.metric}</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Radar
                        name="Threat Index"
                        dataKey="score"
                        stroke="#00f0ff"
                        strokeWidth={2.5}
                        fill="url(#radarNeonGrad)"
                        fillOpacity={0.7}
                        dot={{ r: 4.5, fill: "#00f0ff", stroke: "#ffffff", strokeWidth: 2 }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Score Summary Block with Radiant Glow */}
                <div className="w-full sm:w-2/5 space-y-2.5">
                  <div className={`p-3 rounded-xl border text-center ${subCardBg} ${
                    data?.threat_assessment?.score >= 65 ? "box-glow-amber border-amber-500/50" : "box-glow-cyan border-sky-500/50"
                  }`}>
                    <div className="text-xs font-mono uppercase tracking-wider font-bold text-slate-300">
                      Composite Threat Score
                    </div>
                    <div className="text-3xl font-black font-mono mt-1" style={{ color: data?.threat_assessment?.color || "#38bdf8" }}>
                      <span className="text-glow-sky">{data?.threat_assessment?.score || 0}</span>
                      <span className="text-sm font-normal text-slate-400">/100</span>
                    </div>
                    <div className="text-xs font-mono font-bold uppercase tracking-wider mt-0.5" style={{ color: data?.threat_assessment?.color }}>
                      {data?.threat_assessment?.band || "MODERATE"} RISK
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg border space-y-1.5 text-xs font-mono font-semibold ${subCardBg}`}>
                    <div className="flex justify-between">
                      <span className="text-slate-300">High-Risk Ratio:</span>
                      <strong className="text-white">{data?.threat_assessment?.factors?.high_risk_persons_ratio || 0}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Active Workload:</span>
                      <strong className="text-amber-300 text-glow-amber">{data?.threat_assessment?.factors?.active_investigation_ratio || 0}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Velocity Momentum:</span>
                      <strong className={data?.threat_assessment?.factors?.recent_velocity_trend >= 0 ? "text-amber-400 text-glow-amber" : "text-emerald-400 text-glow-emerald"}>
                        {data?.threat_assessment?.factors?.recent_velocity_trend >= 0
                          ? `+${data?.threat_assessment?.factors?.recent_velocity_trend}%`
                          : `${data?.threat_assessment?.factors?.recent_velocity_trend}%`}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-xs font-mono pt-2 border-t font-semibold text-slate-200" style={{ borderColor: gridStroke }}>
                Verified against <strong className="text-white">{kpis?.high_risk_entities || 0}</strong> high-risk offenders in police database
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              ROW 6: Crime Volume vs Resolution Rate (Scatter) + Matrix
              ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-12 gap-2.5">
            {/* VISUALIZATION 8: Volume vs Resolution Rate Scatter Plot (Col 6) */}
            <div className={`col-span-12 lg:col-span-6 p-4 rounded-xl border flex flex-col justify-between ${cardBg}`}>
              <div className="flex items-center justify-between border-b pb-2.5 mb-2" style={{ borderColor: gridStroke }}>
                <div>
                  <div className="flex items-center gap-2">
                    <ScatterIcon size={16} className="text-emerald-400" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-white text-glow-emerald">
                      Crime Volume vs. Resolution Rate
                    </h2>
                  </div>
                  <p className={`text-xs mt-0.5 font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    District efficiency mapping: incident volume against case disposition clearing rate
                  </p>
                </div>
                <span className="badge badge-info text-[10px] font-mono font-bold">
                  SCATTER MATRIX
                </span>
              </div>

              {/* Scatter Chart Canvas with Glowing Custom Colored Bubbles */}
              <div className="h-60 w-full">
                {!data?.district_scatter || data.district_scatter.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs opacity-50 font-mono">
                    No district scatter data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 25, bottom: 10, left: -15 }}>
                      <defs>
                        <filter id="scatterGlow" x="-50%" y="-50%" width="200%" height="200%">
                          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#38bdf8" floodOpacity="0.8" />
                        </filter>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis
                        type="number"
                        dataKey="crimes"
                        name="Crimes"
                        stroke={axisColor}
                        fontSize={11}
                        fontWeight={600}
                        tickLine={false}
                        axisLine={{ stroke: gridStroke }}
                        unit=" FIRs"
                      />
                      <YAxis
                        type="number"
                        dataKey="resolution_rate"
                        name="Resolution"
                        stroke={axisColor}
                        fontSize={11}
                        fontWeight={600}
                        tickLine={false}
                        axisLine={{ stroke: gridStroke }}
                        unit="%"
                        domain={[0, 100]}
                      />
                      <ZAxis type="number" dataKey="cases" range={[100, 500]} name="Cases" />
                      <RechartsTooltip
                        cursor={{ strokeDasharray: "3 3", stroke: "#38bdf8" }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className={tooltipBg}>
                                <div className="font-bold text-sky-300 text-sm border-b pb-1 text-glow-sky" style={{ borderColor: gridStroke }}>
                                  {p.district}
                                </div>
                                <div className="flex justify-between font-semibold pt-0.5">
                                  <span className="text-slate-300">Total Crimes:</span>
                                  <strong className="text-white">{p.crimes}</strong>
                                </div>
                                <div className="flex justify-between text-emerald-300 font-bold text-glow-emerald">
                                  <span>Resolution Rate:</span>
                                  <strong>{p.resolution_rate}%</strong>
                                </div>
                                <div className="flex justify-between text-amber-300 font-bold">
                                  <span>Active Inquiries:</span>
                                  <strong>{p.active_cases}</strong>
                                </div>
                                <div className="flex justify-between font-semibold">
                                  <span className="text-slate-300">Total Cases:</span>
                                  <strong className="text-white">{p.cases}</strong>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter
                        name="Districts"
                        data={data.district_scatter}
                      >
                        {data.district_scatter.map((entry: any, index: number) => {
                          const distColor = getDistrictColor(entry.district);
                          return (
                            <Cell
                              key={`scatter-cell-${index}`}
                              fill={distColor}
                              stroke="#ffffff"
                              strokeWidth={2}
                            />
                          );
                        })}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="flex items-center justify-between text-xs font-mono pt-2 border-t font-semibold text-slate-200" style={{ borderColor: gridStroke }}>
                <span>X: Total Crime Volume</span>
                <span>Y: Case Clearance %</span>
                <span>Bubble Size: Case Load</span>
              </div>
            </div>

            {/* VISUALIZATION 9: Crime x District Cross-Tab Matrix (Col 6) */}
            <div className={`col-span-12 lg:col-span-6 p-4 rounded-xl border flex flex-col justify-between ${cardBg}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b pb-2.5 mb-2" style={{ borderColor: gridStroke }}>
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-cyan-400" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-white text-glow-cyan">
                      Crime × District Cross-Tab Matrix
                    </h2>
                  </div>
                  <p className={`text-xs mt-0.5 font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    Cross-tabulated category density across each administrative police district
                  </p>
                </div>

                {hoveredMatrixCell && (
                  <div className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold ${
                    isDark ? "bg-slate-950 border-cyan-400 text-cyan-300 text-glow-cyan box-glow-cyan" : "bg-white border-cyan-400 text-cyan-800"
                  }`}>
                    {hoveredMatrixCell.district} · {hoveredMatrixCell.category}: <strong>{hoveredMatrixCell.count}</strong> ({hoveredMatrixCell.pct}%)
                  </div>
                )}
              </div>

              {/* Cross-Tab Heatmap Grid with Rich Vibrant Gradients */}
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-xs font-mono border-collapse min-w-[480px]">
                  <thead>
                    <tr className={`sticky top-0 z-10 ${isDark ? "bg-slate-900" : "bg-white"}`}>
                      <th className={`p-2 text-left text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        DISTRICT / CRIME
                      </th>
                      {data?.crime_district_matrix?.categories?.map((cat: string) => (
                        <th key={cat} className={`p-2 text-center text-xs font-bold truncate max-w-[75px] ${isDark ? "text-slate-200" : "text-slate-700"}`} title={cat}>
                          {cat.slice(0, 6)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data?.crime_district_matrix?.districts?.map((dist: string) => (
                      <tr key={dist} className="border-t hover:opacity-90" style={{ borderColor: gridStroke }}>
                        <td className={`p-2 font-bold text-xs truncate max-w-[120px] ${isDark ? "text-white text-glow-white" : "text-slate-900"}`}>
                          {dist}
                        </td>
                        {data.crime_district_matrix.categories.map((cat: string) => {
                          const cell = data.crime_district_matrix.cells.find(
                            (c: any) => c.district === dist && c.category === cat
                          );
                          const count = cell ? cell.count : 0;
                          const pct = cell ? cell.district_percentage : 0;
                          const maxCount = data.crime_district_matrix.max_cell_count || 1;

                          let bgClass = isDark
                            ? "bg-slate-950/80 text-slate-500 border border-slate-800/80"
                            : "bg-slate-100 text-slate-400";
                          if (count > 0) {
                            const ratio = count / maxCount;
                            if (ratio > 0.6) {
                              // PEAK CONCENTRATION: Hot Neon Cyan / Emerald with intense glow
                              bgClass = "bg-gradient-to-br from-cyan-400 to-emerald-400 text-slate-950 font-black border border-cyan-100 shadow-[0_0_14px_rgba(6,182,212,0.8)] scale-105";
                            } else if (ratio > 0.3) {
                              // MEDIUM CONCENTRATION: Electric Violet / Purple with glow
                              bgClass = isDark
                                ? "bg-purple-900/90 text-purple-100 font-black border border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                                : "bg-purple-200 text-purple-950 font-bold border border-purple-400";
                            } else {
                              // LOW CONCENTRATION: Sapphire Blue with glow
                              bgClass = isDark
                                ? "bg-blue-950/90 text-cyan-300 font-bold border border-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                                : "bg-blue-100 text-blue-900 font-bold border border-blue-300";
                            }
                          }

                          return (
                            <td key={cat} className="p-1 text-center">
                              <div
                                onMouseEnter={() =>
                                  setHoveredMatrixCell({
                                    district: dist,
                                    category: cat,
                                    count,
                                    pct,
                                  })
                                }
                                onMouseLeave={() => setHoveredMatrixCell(null)}
                                className={`h-7 rounded-md flex items-center justify-center text-xs transition-all duration-200 cursor-pointer hover:scale-110 ${bgClass}`}
                                title={`${dist} - ${cat}: ${count} incidents (${pct}%)`}
                              >
                                {count > 0 ? count : "·"}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between text-xs font-mono pt-2 border-t font-semibold text-slate-200" style={{ borderColor: gridStroke }}>
                <span>Cross-tab of 7 districts × 7 categories</span>
                <span>Max cell: <strong className="text-cyan-300 text-glow-cyan">{data?.crime_district_matrix?.max_cell_count || 0} incidents</strong></span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
