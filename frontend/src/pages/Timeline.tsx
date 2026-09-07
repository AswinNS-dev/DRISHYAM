import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  Clock, Filter, Search, RefreshCw, Users, FolderOpen, Calendar, AlertCircle, X, ArrowUpRight,
  PhoneCall, CreditCard, ShieldAlert, FileText, ArrowDownRight, TrendingUp
} from "lucide-react";

export default function Timeline() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramEntityId = searchParams.get("entity_id") || "";
  const paramCaseId = searchParams.get("case_id") || "";

  const [events, setEvents] = useState<any[]>([]);
  const [incidentAnalysis, setIncidentAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string>(paramCaseId);
  const [selectedEntityId, setSelectedEntityId] = useState<string>(paramEntityId);
  const [windowDays, setWindowDays] = useState<number | undefined>(undefined);
  const [caseList, setCaseList] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.cases().then((res) => setCaseList(res.cases || [])).catch(() => {});
  }, []);

  function loadTimeline() {
    setLoading(true);
    api.timeline({
      entity_id: selectedEntityId || undefined,
      case_id: selectedCaseId || undefined,
      event_type: eventTypeFilter || undefined,
      window_days: windowDays,
    })
      .then((res) => {
        setEvents(res.timeline || []);
        setIncidentAnalysis(res.incident_analysis || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadTimeline();
  }, [eventTypeFilter, selectedCaseId, selectedEntityId, windowDays]);

  const filteredEvents = events.filter((e) =>
    !search ||
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.entity_tags?.some((t: any) => t.name.toLowerCase().includes(search.toLowerCase()))
  );

  function getEventBadge(type: string) {
    switch (type) {
      case "FIR_FILED":
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1 shadow-sm">
            <FileText size={10} />
            <span>FIR COMPLAINT</span>
          </span>
        );
      case "TRANSACTION":
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1 shadow-sm">
            <CreditCard size={10} />
            <span>CAPITAL TRANSFER</span>
          </span>
        );
      case "COMMUNICATION":
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/50 flex items-center gap-1 shadow-sm">
            <PhoneCall size={10} />
            <span>CDR TELEPHONY</span>
          </span>
        );
      case "ANOMALY_FLAGGED":
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 flex items-center gap-1 shadow-sm">
            <ShieldAlert size={10} />
            <span>UNUSUAL ACTIVITY</span>
          </span>
        );
      case "TACTICAL_ALERT":
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/50 flex items-center gap-1 shadow-sm">
            <AlertCircle size={10} />
            <span>SURVEILLANCE SIGHTING</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
            CHRONOLOGY
          </span>
        );
    }
  }

  function getTemporalBadge(rel?: string, days?: number) {
    if (!rel) return null;
    switch (rel) {
      case "BEFORE":
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-950/90 text-blue-300 border border-blue-600/60 flex items-center gap-1 shadow-sm whitespace-nowrap">
            <ArrowDownRight size={9} />
            <span>BEFORE INCIDENT {days !== undefined ? `(${Math.abs(days)}d)` : ""}</span>
          </span>
        );
      case "DURING":
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500 text-slate-950 border border-amber-300 shadow-sm flex items-center gap-1 whitespace-nowrap">
            <AlertCircle size={9} className="animate-ping text-slate-950" />
            <span>INCIDENT DAY</span>
          </span>
        );
      case "AFTER":
        return (
          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-teal-950/90 text-teal-300 border border-teal-600/60 flex items-center gap-1 shadow-sm whitespace-nowrap">
            <ArrowUpRight size={9} />
            <span>AFTER INCIDENT {days !== undefined ? `(+${days}d)` : ""}</span>
          </span>
        );
      default:
        return null;
    }
  }

  function getEventVisualConfig(type: string, rel?: string) {
    if (rel === "DURING") {
      return {
        border: "border-l-4 border-l-amber-500 border-amber-500/40 shadow-md",
        gradient: "bg-gradient-to-r from-amber-950/30 via-slate-900/95 to-slate-900",
        spineDot: "border-amber-400 bg-amber-500",
        glowText: "text-amber-300",
      };
    }
    switch (type) {
      case "FIR_FILED":
        return {
          border: "border-l-4 border-l-amber-500 border-slate-800 hover:border-amber-500/50",
          gradient: "bg-gradient-to-r from-amber-950/20 via-slate-900/90 to-slate-900",
          spineDot: "border-amber-400 bg-amber-950",
          glowText: "text-amber-300",
        };
      case "TRANSACTION":
        return {
          border: "border-l-4 border-l-emerald-500 border-slate-800 hover:border-emerald-500/50",
          gradient: "bg-gradient-to-r from-emerald-950/20 via-slate-900/90 to-slate-900",
          spineDot: "border-emerald-400 bg-emerald-950",
          glowText: "text-emerald-300",
        };
      case "COMMUNICATION":
        return {
          border: "border-l-4 border-l-sky-500 border-slate-800 hover:border-sky-500/50",
          gradient: "bg-gradient-to-r from-sky-950/20 via-slate-900/90 to-slate-900",
          spineDot: "border-sky-400 bg-sky-950",
          glowText: "text-sky-300",
        };
      case "ANOMALY_FLAGGED":
        return {
          border: "border-l-4 border-l-rose-500 border-slate-800 hover:border-rose-500/50",
          gradient: "bg-gradient-to-r from-rose-950/25 via-slate-900/90 to-slate-900",
          spineDot: "border-rose-400 bg-rose-950",
          glowText: "text-rose-300",
        };
      case "TACTICAL_ALERT":
        return {
          border: "border-l-4 border-l-purple-500 border-slate-800 hover:border-purple-500/50",
          gradient: "bg-gradient-to-r from-purple-950/20 via-slate-900/90 to-slate-900",
          spineDot: "border-purple-400 bg-purple-950",
          glowText: "text-purple-300",
        };
      default:
        return {
          border: "border-l-4 border-l-slate-600 border-slate-800 hover:border-slate-700",
          gradient: "bg-slate-900",
          spineDot: "border-slate-500 bg-slate-950",
          glowText: "text-slate-200",
        };
    }
  }

  const selectedCaseObj = caseList.find((c) => c.id === selectedCaseId);

  return (
    <div className="flex flex-col h-full bg-[#020617]">
      {/* ── Top Header Strip ── */}
      <div className="px-6 py-4 border-b border-slate-800/90 space-y-3 bg-slate-900/95 backdrop-blur-md">
        {/* Module Metadata Line */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge badge-info text-[10px] font-mono tracking-wider font-bold py-0.5 px-2 bg-slate-800 text-sky-300 border border-sky-500/30 text-glow-sky">
              STATE TEMPORAL & SEQUENCE INTELLIGENCE
            </span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 text-glow-emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE DATABASE SYNCHRONIZED
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Timeline Feed: <span className="text-white font-bold">{events.length}</span> Indexed Events
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-sky-400 border border-slate-800 flex items-center justify-center shadow-md">
              <Clock size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black tracking-wide text-white uppercase text-glow-white">
                  Multi-Source Chronological Timeline
                </h1>
                <span className="badge bg-sky-950/80 border-sky-800/80 text-sky-300 text-[8px] font-mono">
                  TEMPORAL CORRELATION
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Unified cross-source temporal feed: formal FIRs, capital transfers, telephony CDR links, and tactical events
              </p>
            </div>
          </div>

          <button
            onClick={loadTimeline}
            className="p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white bg-slate-950 transition-all cursor-pointer shadow-sm"
            title="Refresh Timeline"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-sky-400" : ""} />
          </button>
        </div>
      </div>

      {/* ── Visual KPI Operational Metrics Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b border-slate-800/90 bg-slate-900/90">
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-sky-400 uppercase tracking-wider font-semibold">Total Indexed Events</span>
            <Clock size={13} className="text-sky-400" />
          </div>
          <div className="text-xl font-black font-mono text-white text-glow-white mt-1">{events.length}</div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">Across all evidence types</div>
        </div>

        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">Multi-Source Types</span>
            <TrendingUp size={13} className="text-emerald-400" />
          </div>
          <div className="text-xl font-black font-mono text-emerald-300 text-glow-emerald mt-1">
            {new Set(events.map((e) => e.event_type)).size} Streams
          </div>
          <div className="text-[10px] font-mono text-emerald-400/80 mt-0.5">FIR, CDR, TX, Alerts</div>
        </div>

        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-semibold">Incident Reference</span>
            <Calendar size={13} className="text-amber-400" />
          </div>
          <div className="text-xs font-mono font-bold text-amber-300 text-glow-amber mt-1.5 truncate">
            {incidentAnalysis?.has_incident_date
              ? new Date(incidentAnalysis.anchor_date).toLocaleDateString()
              : selectedCaseId
              ? "Case reference"
              : "Global chronology"}
          </div>
          <div className="text-[10px] font-mono text-amber-400/80 mt-0.5">
            {windowDays ? `±${windowDays}d window active` : "Full chronology"}
          </div>
        </div>

        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">Temporal Windows</span>
            <Filter size={13} className="text-cyan-400" />
          </div>
          <div className="text-xs font-mono font-bold text-cyan-300 text-glow-cyan mt-1 flex items-center gap-1.5">
            <span className="text-sky-300">{incidentAnalysis?.before_incident_count ?? "-"} B</span>
            <span className="text-slate-500">•</span>
            <span className="text-amber-300">{incidentAnalysis?.during_incident_count ?? "-"} D</span>
            <span className="text-slate-500">•</span>
            <span className="text-teal-300">{incidentAnalysis?.after_incident_count ?? "-"} A</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">Before / During / After</div>
        </div>
      </div>

      {/* ── Filter Controls ── */}
      <div className="px-6 py-2.5 border-b border-slate-800/90 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px] flex-wrap">
          <div className="relative flex-1 max-w-xs min-w-[180px]">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search narrative, entity, tag..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500"
            />
          </div>

          {/* Case Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
            <FolderOpen size={12} className="text-sky-400" />
            <select
              value={selectedCaseId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCaseId(val);
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  if (val) next.set("case_id", val);
                  else next.delete("case_id");
                  return next;
                });
              }}
              className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer max-w-[150px] truncate font-mono"
            >
              <option value="" className="bg-slate-900 text-slate-300">All Cases (Global)</option>
              {caseList.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-slate-200">
                  {c.case_number}: {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Event Type Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
            <Filter size={12} className="text-amber-400" />
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer font-mono"
            >
              <option value="" className="bg-slate-900">All Event Types</option>
              <option value="FIR_FILED" className="bg-slate-900">FIR Complaints</option>
              <option value="TRANSACTION" className="bg-slate-900">Capital Transfers</option>
              <option value="COMMUNICATION" className="bg-slate-900">CDR Telephony Links</option>
              <option value="ANOMALY_FLAGGED" className="bg-slate-900">Unusual Activity</option>
            </select>
          </div>

          {/* Incident Window Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-lg px-2.5 py-1">
            <Calendar size={12} className="text-indigo-400" />
            <select
              value={windowDays === undefined ? "" : windowDays.toString()}
              onChange={(e) => setWindowDays(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-slate-300">All Recorded Time</option>
              <option value="1" className="bg-slate-900 text-slate-200">±1 Day Incident Window</option>
              <option value="3" className="bg-slate-900 text-slate-200">±3 Days Incident Window</option>
              <option value="7" className="bg-slate-900 text-slate-200">±7 Days Incident Window</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400">
          <span className="text-indigo-400 font-bold">{filteredEvents.length}</span> Chronological Events
        </div>
      </div>

      {/* ── Active Scope & Incident Date Banner ── */}
      {(selectedCaseId || selectedEntityId || incidentAnalysis?.has_incident_date) && (
        <div className="px-6 py-2 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {selectedCaseId && (
              <span className="badge bg-sky-950/80 border-sky-700 text-sky-300 text-[10px] font-mono">
                Case Scoped: {selectedCaseObj?.case_number || selectedCaseId.slice(0, 8)}
              </span>
            )}
            {selectedEntityId && (
              <span className="badge bg-purple-950/80 border-purple-700 text-purple-300 text-[10px] font-mono">
                Entity Scoped: {selectedEntityId.slice(0, 8)}
              </span>
            )}
            {incidentAnalysis?.has_incident_date ? (
              <div className="flex items-center gap-1.5 text-slate-200 font-mono text-[11px]">
                <Calendar size={13} className="text-emerald-400" />
                <span>Reference Date: {new Date(incidentAnalysis.anchor_date).toLocaleDateString()}</span>
                {windowDays && (
                  <span className="text-amber-400 font-semibold">(±{windowDays} Days Window)</span>
                )}
              </div>
            ) : selectedCaseId ? (
              <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                <AlertCircle size={12} />
                <span>Selected case has no fixed incident anchor date. Displaying all recorded temporal events.</span>
              </div>
            ) : null}
          </div>

          {(selectedCaseId || selectedEntityId || windowDays) && (
            <button
              onClick={() => {
                setSelectedCaseId("");
                setSelectedEntityId("");
                setWindowDays(undefined);
                setSearchParams({});
              }}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
            >
              <X size={12} />
              <span>Reset Context</span>
            </button>
          )}
        </div>
      )}

      {/* ── Main Timeline Spine & Event Cards ── */}
      <div className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton h-24 rounded-lg" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="panel p-12 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-panel-solid)] rounded-lg">
            <Clock size={32} className="mx-auto mb-2 opacity-30 text-indigo-400" />
            <div className="font-semibold text-[var(--text-secondary)] uppercase">No chronological records matched</div>
            <p className="mt-1 text-[11px] text-slate-400">
              {windowDays
                ? `No events found within ±${windowDays} days of the incident date. Try switching to "All Recorded Time".`
                : "No events recorded matching the active filters."}
            </p>
          </div>
        ) : (
          <div className="relative pl-7 border-l-2 border-slate-700/80 space-y-5">
            {filteredEvents.map((evt, idx) => {
              const dateObj = evt.timestamp ? new Date(evt.timestamp) : new Date();
              const cfg = getEventVisualConfig(evt.event_type, evt.temporal_relation);

              return (
                <div key={evt.id || idx} className="relative group">
                  {/* Dot on spine with custom event color */}
                  <div
                    className={`absolute -left-[37px] top-3.5 w-4 h-4 rounded-full flex items-center justify-center border-2 transition-transform group-hover:scale-125 ${cfg.spineDot}`}
                  />

                  {/* Event Card with rich visual color & gradient */}
                  <div
                    className={`panel p-4 rounded-lg border transition-all space-y-2.5 ${cfg.border} ${cfg.gradient}`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getEventBadge(evt.event_type)}
                        {getTemporalBadge(evt.temporal_relation, evt.days_from_incident)}
                        <span className="text-xs font-bold text-slate-100">
                          {evt.title}
                        </span>
                      </div>

                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 shrink-0">
                        <Clock size={11} className="text-indigo-400" />
                        <span>
                          {dateObj.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}{" "}
                          {dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} IST
                        </span>
                      </div>
                    </div>

                    {/* Narrative Description */}
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {evt.description}
                    </p>

                    {/* Specific Event Metadata Highlight (e.g. Transaction Amount, Duration) */}
                    {evt.event_type === "TRANSACTION" && evt.meta?.amount && (
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-slate-400">Transfer Sum:</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 font-bold">
                          ₹{Number(evt.meta.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {/* Footer Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 uppercase">Source Record:</span>
                        <span className="text-sky-400 font-semibold bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                          {evt.source_doc || "Incident Record"}
                        </span>
                      </div>

                      {evt.entity_tags?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Users size={11} className="text-slate-400" />
                          {evt.entity_tags.map((t: any) => (
                            <span
                              key={t.id}
                              onClick={() =>
                                navigate(
                                  `/network?entity_id=${t.id}${
                                    selectedCaseId ? `&case_id=${selectedCaseId}` : ""
                                  }`
                                )
                              }
                              className="px-2 py-0.5 rounded bg-slate-800/90 text-slate-300 hover:text-sky-300 hover:border-sky-500 border border-slate-700 cursor-pointer flex items-center gap-1 transition-all shadow-sm"
                              title="Pivot to Network Graph"
                            >
                              <span>{t.name}</span>
                              <ArrowUpRight size={9} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
