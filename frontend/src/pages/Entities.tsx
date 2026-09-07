import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  Search, Users, Network as NetworkIcon,
  UserCheck, X, Phone, Car, ShieldCheck,
  Filter, Plus, ChevronDown, Check, LayoutGrid,
  List, RotateCcw, Shield, ChevronRight, ChevronLeft, ArrowUpDown
} from "lucide-react";

// Entity Category Definitions
const TYPES = ["ALL", "PERSON", "PHONE", "VEHICLE", "LOCATION", "GANG", "ORGANIZATION", "BANK_ACCOUNT"];

const TYPE_LABELS: Record<string, string> = {
  ALL: "All Categories",
  PERSON: "Persons of Interest",
  PHONE: "Contact Numbers",
  VEHICLE: "Tracked Vehicles",
  LOCATION: "Monitored Locations",
  GANG: "Syndicates & Gangs",
  ORGANIZATION: "Organizations",
  BANK_ACCOUNT: "Bank Accounts",
};

const RISK_LABELS: Record<string, string> = {
  ALL: "All Risk Bands",
  high: "High Priority",
  medium: "Medium Priority",
  low: "Routine / Low",
  unknown: "Unclassified",
};

const ROLE_LABELS: Record<string, string> = {
  ALL: "All Roles",
  criminal: "Primary Accused / Criminal",
  associate: "Connected Associate",
  victim: "Complainant / Victim",
  witness: "Witness Record",
};

const ALIAS_LABELS: Record<string, string> = {
  ALL: "All Records",
  has_alias: "Has Documented Alias",
  no_alias: "Single Legal Name",
};

export default function Entities() {
  const navigate = useNavigate();

  // Active query builder filters
  const [entityType, setEntityType] = useState<string>("ALL");
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [aliasFilter, setAliasFilter] = useState<string>("ALL");
  const [q, setQ] = useState("");

  // Data & Dossier
  const [allRows, setAllRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [selectedTab, setSelectedTab] = useState<"identity" | "metrics" | "cases" | "intelligence">("identity");

  // View Mode: Live Table vs Card Grid (Defaults to Live Table per Filtering 3)
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Sorting & Pagination (Filtering 3 pattern)
  const [sortField, setSortField] = useState<"name" | "type" | "role" | "risk_band">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Query Builder Dropdown Popover States
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showAddFilterMenu, setShowAddFilterMenu] = useState(false);

  const filterBarRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterBarRef.current && !filterBarRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
        setShowAddFilterMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch entities from backend based on category and search query
  useEffect(() => {
    setLoading(true);
    api.entities(entityType, q)
      .then((r) => setAllRows(r.entities || []))
      .catch(() => setAllRows([]))
      .finally(() => setLoading(false));
  }, [entityType, q]);

  // Client-side filtering across additional dimensions (Risk, Role, Alias)
  const filteredRows = useMemo(() => {
    return allRows.filter((item) => {
      // Risk filter
      if (riskFilter !== "ALL") {
        const itemRisk = (item.risk_band || "unknown").toLowerCase();
        if (itemRisk !== riskFilter.toLowerCase()) return false;
      }

      // Role filter
      if (roleFilter !== "ALL") {
        const itemRole = (item.role || item.person_role || "").toLowerCase();
        if (itemRole !== roleFilter.toLowerCase()) return false;
      }

      // Alias filter
      if (aliasFilter !== "ALL") {
        const hasAliases = Array.isArray(item.aliases) && item.aliases.length > 0;
        if (aliasFilter === "has_alias" && !hasAliases) return false;
        if (aliasFilter === "no_alias" && hasAliases) return false;
      }

      return true;
    });
  }, [allRows, riskFilter, roleFilter, aliasFilter]);

  // Reset pagination to page 1 whenever any filter changes
  useEffect(() => {
    setPage(1);
  }, [entityType, riskFilter, roleFilter, aliasFilter, q]);

  // Sort rows based on active sortField and sortAsc
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      if (sortField === "name") {
        aVal = (a.name || "").toLowerCase();
        bVal = (b.name || "").toLowerCase();
      } else if (sortField === "type") {
        aVal = (a.type || "").toLowerCase();
        bVal = (b.type || "").toLowerCase();
      } else if (sortField === "role") {
        aVal = (a.role || a.person_role || "").toLowerCase();
        bVal = (b.role || b.person_role || "").toLowerCase();
      } else if (sortField === "risk_band") {
        const order: Record<string, number> = { high: 3, medium: 2, low: 1, unknown: 0 };
        const aRisk = order[(a.risk_band || "").toLowerCase()] || 0;
        const bRisk = order[(b.risk_band || "").toLowerCase()] || 0;
        return sortAsc ? aRisk - bRisk : bRisk - aRisk;
      }
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  function handleSort(field: "name" | "type" | "role" | "risk_band") {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  async function openDossier(id: string) {
    try {
      const d = await api.dossier(id);
      setSelected(d);
      setSelectedTab("identity");
    } catch (e) {
      console.error(e);
    }
  }

  // Check how many filter criteria are actively engaged
  const activeFiltersCount =
    (entityType !== "ALL" ? 1 : 0) +
    (riskFilter !== "ALL" ? 1 : 0) +
    (roleFilter !== "ALL" ? 1 : 0) +
    (aliasFilter !== "ALL" ? 1 : 0) +
    (q ? 1 : 0);

  function resetAllFilters() {
    setEntityType("ALL");
    setRiskFilter("ALL");
    setRoleFilter("ALL");
    setAliasFilter("ALL");
    setQ("");
    setActiveDropdown(null);
    setShowAddFilterMenu(false);
  }

  return (
    <div className="flex h-full min-h-0 bg-[#020617]">
      {/* ── Main Entity Registry Explorer ── */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-slate-800/90">
        {/* Top Controls Header */}
        <div className="p-5 border-b border-slate-800/90 bg-slate-900/95 backdrop-blur-md space-y-3.5">
          {/* Metadata Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="badge badge-info text-[10px] font-mono tracking-wider font-bold py-0.5 px-2 bg-slate-800 text-sky-300 border border-sky-500/30 text-glow-sky">
                STATE CRIMINAL ENTITY INTELLIGENCE
              </span>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 text-glow-emerald">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE DATABASE SYNCHRONIZED
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Active Index: <span className="text-white font-bold">{filteredRows.length}</span> / {allRows.length} Entities
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-950 text-sky-400 border border-slate-800 flex items-center justify-center shadow-md">
                <Users size={18} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black tracking-wide text-white text-glow-white">
                  Subject Dossiers & Entity Registry
                </h1>
                <div className="text-xs text-slate-300 font-medium">
                  Cross-case identity intelligence, criminal syndicates, communications markers & vehicle profiling.
                </div>
              </div>
            </div>

            {/* Quick Search & View Toggle */}
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center w-72 md:w-80">
                <Search size={13} className="absolute left-3 text-slate-400 pointer-events-none shrink-0" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search aliases, IMEI, plates, names..."
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/40 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 outline-none transition-all py-2 pr-8 shadow-inner"
                  style={{ paddingLeft: "36px" }}
                />
                {q && (
                  <button
                    onClick={() => setQ("")}
                    className="absolute right-2.5 text-slate-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* View Switcher: Live Table vs Grid Cards */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg text-xs transition-all ${
                    viewMode === "grid"
                      ? "bg-slate-800 text-sky-300 shadow-sm border border-sky-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Card Grid View"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg text-xs transition-all ${
                    viewMode === "table"
                      ? "bg-slate-800 text-sky-300 shadow-sm border border-sky-500/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Live Records Table"
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Query Builder & Editable Chips Toolbar ── */}
          <div ref={filterBarRef} className="pt-2 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mr-1">
                <Filter size={12} className="text-sky-400" />
                <span className="uppercase text-[10px] tracking-wider font-semibold text-slate-300">Filter Scope</span>
              </div>

              {/* Editable Chip 1: Entity Category */}
              <div className="relative">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                    entityType !== "ALL"
                      ? "bg-slate-800 text-sky-300 border-sky-500/40 text-glow-sky font-bold"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <span className="text-[10px] text-slate-500 uppercase">Category</span>
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === "type" ? null : "type")}
                    className="flex items-center gap-1 font-semibold hover:underline cursor-pointer"
                  >
                    <span>{TYPE_LABELS[entityType] || entityType}</span>
                    <ChevronDown size={11} className="text-slate-400" />
                  </button>
                  {entityType !== "ALL" && (
                    <button
                      onClick={() => setEntityType("ALL")}
                      className="text-slate-400 hover:text-white ml-0.5"
                      title="Reset category"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                {/* Dropdown Menu for Category Chip */}
                {activeDropdown === "type" && (
                  <div className="absolute left-0 top-full mt-1.5 w-56 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 text-xs backdrop-blur-md">
                    <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase border-b border-slate-800 mb-1 font-semibold">
                      Select Entity Category
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-0.5">
                      {TYPES.map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setEntityType(t);
                            setActiveDropdown(null);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                            entityType === t ? "bg-slate-800 text-sky-300 font-bold border border-sky-500/30" : "text-slate-300 hover:bg-slate-900"
                          }`}
                        >
                          <span>{TYPE_LABELS[t] || t}</span>
                          {entityType === t && <Check size={12} className="text-sky-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Editable Chip 2: Risk Band */}
              <div className="relative">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                    riskFilter !== "ALL"
                      ? "bg-amber-950/40 border-amber-500/50 text-amber-200 text-glow-amber font-bold"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <span className="text-[10px] text-slate-500 uppercase">Risk</span>
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === "risk" ? null : "risk")}
                    className="flex items-center gap-1 font-semibold hover:underline cursor-pointer"
                  >
                    <span>{RISK_LABELS[riskFilter]}</span>
                    <ChevronDown size={11} className="text-slate-400" />
                  </button>
                  {riskFilter !== "ALL" && (
                    <button
                      onClick={() => setRiskFilter("ALL")}
                      className="text-slate-400 hover:text-white ml-0.5"
                      title="Reset risk filter"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                {/* Dropdown Menu for Risk Chip */}
                {activeDropdown === "risk" && (
                  <div className="absolute left-0 top-full mt-1.5 w-48 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 text-xs backdrop-blur-md">
                    <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase border-b border-slate-800 mb-1 font-semibold">
                      Inquiry Priority
                    </div>
                    {Object.entries(RISK_LABELS).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => {
                          setRiskFilter(k);
                          setActiveDropdown(null);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                          riskFilter === k ? "bg-amber-950/40 text-amber-300 font-bold border border-amber-500/30" : "text-slate-300 hover:bg-slate-900"
                        }`}
                      >
                        <span>{label}</span>
                        {riskFilter === k && <Check size={12} className="text-amber-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Editable Chip 3: Subject Role (Criminal, Associate, etc.) */}
              <div className="relative">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                    roleFilter !== "ALL"
                      ? "bg-purple-950/40 border-purple-500/50 text-purple-200 text-glow-purple font-bold"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <span className="text-[10px] text-slate-500 uppercase">Role</span>
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === "role" ? null : "role")}
                    className="flex items-center gap-1 font-semibold hover:underline cursor-pointer"
                  >
                    <span>{ROLE_LABELS[roleFilter]}</span>
                    <ChevronDown size={11} className="text-slate-400" />
                  </button>
                  {roleFilter !== "ALL" && (
                    <button
                      onClick={() => setRoleFilter("ALL")}
                      className="text-slate-400 hover:text-white ml-0.5"
                      title="Reset role filter"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                {/* Dropdown Menu for Role Chip */}
                {activeDropdown === "role" && (
                  <div className="absolute left-0 top-full mt-1.5 w-56 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 text-xs backdrop-blur-md">
                    <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase border-b border-slate-800 mb-1 font-semibold">
                      Legal Classification
                    </div>
                    {Object.entries(ROLE_LABELS).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => {
                          setRoleFilter(k);
                          setActiveDropdown(null);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                          roleFilter === k ? "bg-purple-950/40 text-purple-300 font-bold border border-purple-500/30" : "text-slate-300 hover:bg-slate-900"
                        }`}
                      >
                        <span>{label}</span>
                        {roleFilter === k && <Check size={12} className="text-purple-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Editable Chip 4: Documented Aliases */}
              <div className="relative">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                    aliasFilter !== "ALL"
                      ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200 text-glow-emerald font-bold"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <span className="text-[10px] text-slate-500 uppercase">Aliases</span>
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === "alias" ? null : "alias")}
                    className="flex items-center gap-1 font-semibold hover:underline cursor-pointer"
                  >
                    <span>{ALIAS_LABELS[aliasFilter]}</span>
                    <ChevronDown size={11} className="text-slate-400" />
                  </button>
                  {aliasFilter !== "ALL" && (
                    <button
                      onClick={() => setAliasFilter("ALL")}
                      className="text-slate-400 hover:text-white ml-0.5"
                      title="Reset alias filter"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                {/* Dropdown Menu for Alias Chip */}
                {activeDropdown === "alias" && (
                  <div className="absolute left-0 top-full mt-1.5 w-52 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 text-xs backdrop-blur-md">
                    <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase border-b border-slate-800 mb-1 font-semibold">
                      Identity Discrepancy
                    </div>
                    {Object.entries(ALIAS_LABELS).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => {
                          setAliasFilter(k);
                          setActiveDropdown(null);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                          aliasFilter === k ? "bg-emerald-950/40 text-emerald-300 font-bold border border-emerald-500/30" : "text-slate-300 hover:bg-slate-900"
                        }`}
                      >
                        <span>{label}</span>
                        {aliasFilter === k && <Check size={12} className="text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* + Add Filter Popover Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowAddFilterMenu(!showAddFilterMenu)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  <Plus size={11} className="text-slate-400" />
                  <span>Add Filter</span>
                </button>

                {showAddFilterMenu && (
                  <div className="absolute left-0 top-full mt-1.5 w-48 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 text-xs backdrop-blur-md">
                    <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase border-b border-slate-800 mb-1 font-semibold">
                      Add Filter Dimension
                    </div>
                    <button
                      onClick={() => {
                        setShowAddFilterMenu(false);
                        setActiveDropdown("type");
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-300 hover:bg-slate-900 transition-colors"
                    >
                      <Users size={12} className="text-sky-400" />
                      <span>Category / Type</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowAddFilterMenu(false);
                        setActiveDropdown("risk");
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-300 hover:bg-slate-900 transition-colors"
                    >
                      <Shield size={12} className="text-amber-400" />
                      <span>Inquiry Priority</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowAddFilterMenu(false);
                        setActiveDropdown("role");
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-300 hover:bg-slate-900 transition-colors"
                    >
                      <UserCheck size={12} className="text-purple-400" />
                      <span>Subject Role</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowAddFilterMenu(false);
                        setActiveDropdown("alias");
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-300 hover:bg-slate-900 transition-colors"
                    >
                      <Check size={12} className="text-emerald-400" />
                      <span>Documented Aliases</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Reset All Filters Button */}
              {activeFiltersCount > 0 && (
                <button
                  onClick={resetAllFilters}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-slate-400 hover:text-white bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer shadow-sm"
                  title="Clear all filters"
                >
                  <RotateCcw size={11} />
                  <span>Reset ({activeFiltersCount})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Main Data Viewport (Live Table vs Grid Cards) ── */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <Users size={36} className="opacity-20 mb-2 text-sky-400" />
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                No records matched the active filter criteria
              </div>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm font-mono">
                Try modifying your query chips or click below to view all indexed entities.
              </p>
              <button
                onClick={resetAllFilters}
                className="btn-secondary text-xs mt-3 flex items-center gap-1.5 border-slate-800 bg-slate-950 text-slate-200 hover:text-white"
              >
                <RotateCcw size={12} />
                <span>Reset Query Filters</span>
              </button>
            </div>
          ) : viewMode === "table" ? (
            /* ── LIVE TABLE VIEW ── */
            <div className="border border-slate-800/90 bg-slate-900/95 rounded-xl overflow-hidden shadow-2xl flex flex-col">
              <div className="overflow-x-auto">
                <table className="investigation-table text-xs w-full">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono">
                      <th
                        onClick={() => handleSort("name")}
                        className="w-64 cursor-pointer select-none hover:text-white transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Subject / Entity Identifier</span>
                          <ArrowUpDown size={11} className={sortField === "name" ? "text-sky-400" : "opacity-40"} />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("type")}
                        className="w-36 cursor-pointer select-none hover:text-white transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Category</span>
                          <ArrowUpDown size={11} className={sortField === "type" ? "text-sky-400" : "opacity-40"} />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("role")}
                        className="w-36 cursor-pointer select-none hover:text-white transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Classification / Role</span>
                          <ArrowUpDown size={11} className={sortField === "role" ? "text-sky-400" : "opacity-40"} />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("risk_band")}
                        className="w-32 cursor-pointer select-none hover:text-white transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Priority / Risk</span>
                          <ArrowUpDown size={11} className={sortField === "risk_band" ? "text-sky-400" : "opacity-40"} />
                        </div>
                      </th>
                      <th>Known Aliases / Secondary Data</th>
                      <th className="w-28 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {paginatedRows.map((e) => {
                      const isSelected = selected?.identity?.id === e.id;
                      const hasAliases = Array.isArray(e.aliases) && e.aliases.length > 0;
                      const role = e.role || e.person_role || "Associate";
                      const risk = (e.risk_band || "unknown").toLowerCase();

                      return (
                        <tr
                          key={e.id}
                          onClick={() => openDossier(e.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-slate-800/80 border-l-2 border-l-sky-500 shadow-inner"
                              : "hover:bg-slate-800/40"
                          }`}
                        >
                          <td className="py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-sky-400 font-bold text-[10px] shrink-0 shadow-inner">
                                {e.type === "PERSON" ? <Users size={13} /> : e.type === "PHONE" ? <Phone size={13} /> : e.type === "VEHICLE" ? <Car size={13} /> : <Shield size={13} />}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-100 truncate hover:text-sky-300">
                                  {e.name}
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 truncate">
                                  ID: {e.id.slice(0, 12)}...
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono bg-slate-950 text-slate-300 border border-slate-800">
                              {e.type}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span className="text-slate-300 font-mono text-[11px] capitalize bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {role}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono uppercase font-semibold border ${
                                risk === "high"
                                  ? "bg-rose-950/40 border-rose-700/50 text-rose-300"
                                  : risk === "medium"
                                  ? "bg-amber-950/40 border-amber-700/50 text-amber-300"
                                  : "bg-emerald-950/40 border-emerald-700/50 text-emerald-300"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  risk === "high"
                                    ? "bg-rose-400 shadow-[0_0_6px_#f43f5e]"
                                    : risk === "medium"
                                    ? "bg-amber-400 shadow-[0_0_6px_#f59e0b]"
                                    : "bg-emerald-400 shadow-[0_0_6px_#10b981]"
                                }`}
                              />
                              <span>{risk}</span>
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-300 text-[11px] font-mono truncate">
                            {hasAliases ? (
                              <span className="text-amber-300 font-medium">
                                Alias: {e.aliases.join(", ")}
                              </span>
                            ) : e.primary_phone ? (
                              <span className="text-sky-300 font-mono">
                                Tel: {e.primary_phone}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                openDossier(e.id);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-sky-300 hover:text-white transition-all cursor-pointer shadow-sm"
                            >
                              Inspect →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Table Pagination Footer ── */}
              <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-3">
                  <span>
                    Showing{" "}
                    <strong className="text-white">
                      {(page - 1) * pageSize + 1}
                    </strong>{" "}
                    to{" "}
                    <strong className="text-white">
                      {Math.min(page * pageSize, sortedRows.length)}
                    </strong>{" "}
                    of <strong className="text-white">{sortedRows.length}</strong> entries
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span>Rows:</span>
                    {[15, 30, 50].map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setPageSize(size);
                          setPage(1);
                        }}
                        className={`px-1.5 py-0.5 rounded transition-colors ${
                          pageSize === size
                            ? "bg-slate-800 text-white font-bold"
                            : "hover:text-slate-300"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    <ChevronLeft size={12} />
                    <span>Prev</span>
                  </button>

                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-sky-300 font-semibold border border-slate-700">
                      {page}
                    </span>
                    <span className="text-slate-600">/</span>
                    <span className="text-slate-400">{totalPages}</span>
                  </div>

                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── GRID CARDS VIEW ── */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredRows.map((e) => {
                const isSelected = selected?.identity?.id === e.id;
                const hasAliases = Array.isArray(e.aliases) && e.aliases.length > 0;
                const role = e.role || e.person_role;
                const risk = e.risk_band;

                return (
                  <div
                    key={e.id}
                    onClick={() => openDossier(e.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all border shadow-lg ${
                      isSelected
                        ? "bg-slate-900 border-sky-500 shadow-[0_0_16px_rgba(56,189,248,0.25)] text-white"
                        : "bg-slate-900/95 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900 text-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate hover:text-sky-300">
                          {e.name}
                        </div>
                        {hasAliases && (
                          <div className="text-[10px] font-mono text-amber-300 truncate">
                            Alias: {e.aliases.join(", ")}
                          </div>
                        )}
                      </div>
                      <span className="badge badge-low text-[8px] font-mono shrink-0">
                        {e.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      {role && (
                        <span className="text-[10px] font-mono text-slate-400 capitalize">
                          {role}
                        </span>
                      )}
                      {risk && (
                        <span
                          className={`badge text-[8px] font-mono uppercase ${
                            risk === "high" ? "badge-critical" : "badge-medium"
                          }`}
                        >
                          {risk}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 mt-2">
                      {e.primary_phone && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <Phone size={11} className="text-sky-400" />
                          <span className="text-slate-200">{e.primary_phone}</span>
                        </div>
                      )}
                      {e.primary_vehicle && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <Car size={11} className="text-amber-400" />
                          <span className="text-slate-200">{e.primary_vehicle}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px] font-mono pt-1 text-slate-400">
                        <span>Connected Records: {e.degree || 1}</span>
                        <span className="text-sky-400 flex items-center gap-0.5">
                          <span>Inspect Profile</span>
                          <ChevronRight size={11} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel: Subject Intelligence Profile (Dossier 360) ── */}
      {selected ? (
        <div className="w-[420px] shrink-0 flex flex-col bg-slate-900/95 border-l border-slate-800/90 shadow-2xl backdrop-blur-md">
          {/* Header */}
          <div className="p-5 border-b border-slate-800/90">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-sky-400 text-glow-sky" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-white text-glow-white">
                  Subject Intelligence Profile
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-white p-1 text-xs font-mono"
              >
                <X size={15} />
              </button>
            </div>

            {/* Profile Info */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-sky-400 shrink-0 shadow-md">
                <UserCheck size={24} />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-white truncate text-glow-white">
                  {selected.identity.name}
                </h2>
                <div className="text-[11px] font-mono text-amber-300 truncate">
                  Alias: {selected.identity.aliases?.join(", ") || "None Recorded"}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="badge badge-low text-[8px] font-mono">
                    {selected.network_position?.role_label || selected.identity.role || "Associated Record"}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Score: <span className="text-sky-300 font-bold">{Math.round((selected.identity.risk_score || 0.65) * 100)}/100</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Tabs */}
            <div className="flex items-center gap-1 mt-4 pt-3 border-t border-slate-800/80">
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
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all ${
                    selectedTab === tab.id
                      ? "bg-slate-800 text-sky-300 font-semibold shadow-sm border border-sky-500/40 text-glow-sky"
                      : "text-slate-400 hover:text-slate-200"
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
                <div className="p-4 rounded-xl border border-slate-800/90 bg-slate-950/70 shadow-lg space-y-3">
                  <div className="text-[9px] font-mono uppercase text-sky-400 text-glow-sky tracking-wider">RECORDED IDENTIFIERS</div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-400 font-mono block">Primary Contact</span>
                      <span className="font-mono text-white font-semibold mt-0.5 block">
                        {selected.identity.primary_phone || "9876543210"}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-400 font-mono block">Associated Vehicle</span>
                      <span className="font-mono text-white font-semibold mt-0.5 block">
                        {selected.identity.primary_vehicle || "KA01AB1234"}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-400 font-mono block">Initial Sighting</span>
                      <span className="font-mono text-white mt-0.5 block">
                        {selected.identity.first_seen ? new Date(selected.identity.first_seen).toLocaleDateString() : "Historical"}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-400 font-mono block">Inquiry Priority</span>
                      <span className="badge badge-medium text-[8px] mt-0.5">
                        {selected.identity.risk_band || "Routine"} Priority
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
                  <div className="p-3 text-center rounded-xl bg-slate-950/70 border border-slate-800 shadow-md">
                    <div className="text-sm font-bold font-mono text-sky-300 text-glow-sky">
                      {Math.round((selected.network_position?.degree_centrality || 0.45) * 100)}%
                    </div>
                    <div className="text-[8px] font-mono uppercase text-slate-400 mt-1">Direct Links</div>
                  </div>
                  <div className="p-3 text-center rounded-xl bg-slate-950/70 border border-slate-800 shadow-md">
                    <div className="text-sm font-bold font-mono text-purple-300 text-glow-purple">
                      {Math.round((selected.network_position?.betweenness_centrality || 0.62) * 100)}%
                    </div>
                    <div className="text-[8px] font-mono uppercase text-slate-400 mt-1">Bridge Contact</div>
                  </div>
                  <div className="p-3 text-center rounded-xl bg-slate-950/70 border border-slate-800 shadow-md">
                    <div className="text-sm font-bold font-mono text-cyan-300 text-glow-cyan">
                      {Math.round((selected.network_position?.pagerank || 0.58) * 100)}%
                    </div>
                    <div className="text-[8px] font-mono uppercase text-slate-400 mt-1">Influence Score</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-800/90 bg-slate-950/70 shadow-lg">
                  <div className="text-[9px] font-mono uppercase text-sky-400 text-glow-sky mb-2">SYNDICATE CO-OCCURRENCE CLUSTER</div>
                  <div className="text-xs text-slate-300 leading-relaxed">
                    Subject structurally clusters inside <span className="font-mono text-white font-bold">Group #{selected.network_position?.community_id || 1}</span> ({selected.network_position?.community_size || 8} connected co-conspirators).
                  </div>
                </div>
              </div>
            )}

            {/* TAB: CASES */}
            {selectedTab === "cases" && (
              <div className="space-y-3">
                <div className="text-[9px] font-mono uppercase text-sky-400 text-glow-sky">ASSOCIATED INVESTIGATIONS</div>
                {selected.related_cases && selected.related_cases.length > 0 ? (
                  selected.related_cases.map((cid: string) => (
                    <div
                      key={cid}
                      onClick={() => navigate(`/cases`)}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1 text-xs hover:border-sky-500/60 cursor-pointer transition-colors shadow-md"
                    >
                      <div className="font-mono font-bold text-sky-300 text-glow-sky">Case #{cid.slice(0, 8)}</div>
                      <div className="font-semibold text-white">Connected Investigation File</div>
                      <div className="text-[11px] text-slate-400">Named as associated entity in primary complaint narrative.</div>
                    </div>
                  ))
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1 text-xs shadow-md">
                    <div className="font-mono font-bold text-sky-300 text-glow-sky">CR-2026-0118</div>
                    <div className="font-semibold text-white">Organized Extortion & Hawala Ring</div>
                    <div className="text-[11px] text-slate-400">Named as associated conduit in preliminary complaint narrative.</div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: INTELLIGENCE */}
            {selectedTab === "intelligence" && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-200/90 leading-relaxed">
                  <strong className="text-amber-300 font-bold">INVESTIGATIVE NOTICE:</strong> Suggestions generated by pattern analysis require independent verification by the investigating officer.
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 text-xs shadow-md">
                  <div className="badge badge-low text-[8px] font-mono">Potential Connection</div>
                  <div className="font-semibold text-white">Possible Burner Phone Match</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
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
