import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  PhoneCall, Search, Filter, RefreshCw, Radio,
  ChevronRight, FolderOpen, X, Clock, Network, Share2, Layers,
  ShieldAlert, CheckCircle2, Users
} from "lucide-react";

export default function Communications() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramEntityId = searchParams.get("entity_id") || "";
  const paramCaseId = searchParams.get("case_id") || "";

  const [communications, setCommunications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minFrequency, setMinFrequency] = useState<number>(1);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(paramCaseId);
  const [selectedEntityId, setSelectedEntityId] = useState<string>(paramEntityId);
  const [viewMode, setViewMode] = useState<"list" | "matrix">("list");
  const [caseList, setCaseList] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, uniqueTransceivers: 0 });

  useEffect(() => {
    api.cases().then((res) => setCaseList(res.cases || [])).catch(() => {});
  }, []);

  function loadCommunications() {
    setLoading(true);
    api.communications({
      entity_id: selectedEntityId || undefined,
      case_id: selectedCaseId || undefined,
      q: search || undefined,
    })
      .then((res) => {
        setCommunications(res.communications || []);
        setStats({
          total: res.total_records || 0,
          uniqueTransceivers: res.unique_transceivers || 0,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadCommunications();
  }, [search, selectedCaseId, selectedEntityId]);

  const filtered = communications.filter(
    (c) => (c.frequency_count || 1) >= minFrequency
  );

  const selectedCaseObj = caseList.find((c) => c.id === selectedCaseId);

  return (
    <div className="flex flex-col h-full bg-[#020617]">
      {/* ── Top Header Strip ── */}
      <div className="px-6 py-4 border-b border-slate-800/90 space-y-3 bg-slate-900/95 backdrop-blur-md">
        {/* Module Metadata Line */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge badge-info text-[10px] font-mono tracking-wider font-bold py-0.5 px-2 bg-slate-800 text-sky-300 border border-sky-500/30 text-glow-sky">
              STATE COMMUNICATIONS & TELEPHONY SURVEILLANCE
            </span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 text-glow-emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE DATABASE SYNCHRONIZED
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            CDR Registry: <span className="text-white font-bold">{stats.total}</span> Telephony Intercepts
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-sky-400 border border-slate-800 flex items-center justify-center shadow-md">
              <Radio size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black tracking-wide text-white uppercase text-glow-white">
                  Communications & Telephony Analysis
                </h1>
                <span className="badge bg-sky-950/80 border-sky-800/80 text-sky-300 text-[8px] font-mono">
                  CDR INTELLIGENCE
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Call Detail Records (CDR), handset usage links, and transceiver frequency matrix
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs shadow-inner">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-mono text-xs cursor-pointer ${
                  viewMode === "list"
                    ? "bg-slate-800 text-sky-300 border border-sky-500/40 text-glow-sky font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers size={12} />
                <span>CDR Feed</span>
              </button>
              <button
                onClick={() => setViewMode("matrix")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-mono text-xs cursor-pointer ${
                  viewMode === "matrix"
                    ? "bg-slate-800 text-sky-300 border border-sky-500/40 text-glow-sky font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Share2 size={12} />
                <span>Topology Matrix</span>
              </button>
            </div>

            <button
              onClick={loadCommunications}
              className="p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white bg-slate-950 transition-all cursor-pointer shadow-sm"
              title="Refresh CDR Feed"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-sky-400" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Visual KPI Operational Metrics Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b border-slate-800/90 bg-slate-900/90">
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-sky-400 uppercase tracking-wider font-semibold">Active Telephony Records</span>
            <Radio size={13} className="text-sky-400" />
          </div>
          <div className="text-xl font-black font-mono text-white text-glow-white mt-1">{stats.total}</div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">Indexed CDR calls</div>
        </div>

        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider font-semibold">Unique Transceivers</span>
            <Users size={13} className="text-purple-400" />
          </div>
          <div className="text-xl font-black font-mono text-purple-300 text-glow-purple mt-1">{stats.uniqueTransceivers}</div>
          <div className="text-[10px] font-mono text-purple-400/70 mt-0.5">Tracked handsets</div>
        </div>

        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-semibold">High-Frequency Pairs</span>
            <ShieldAlert size={13} className="text-amber-400" />
          </div>
          <div className="text-xl font-black font-mono text-amber-300 text-glow-amber mt-1">
            {communications.filter((c) => (c.frequency_count || 1) >= 8).length}
          </div>
          <div className="text-[10px] font-mono text-amber-400/80 mt-0.5">≥ 8 calls logged</div>
        </div>

        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">Protocol Compliance</span>
            <CheckCircle2 size={13} className="text-emerald-400" />
          </div>
          <div className="text-xs font-mono font-bold text-emerald-300 text-glow-emerald mt-1.5">TRAI CDR Spec V2</div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">Audited telephony ingest</div>
        </div>
      </div>

      {/* ── Filter Controls ── */}
      <div className="px-6 py-2.5 border-b border-slate-800/90 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, MSISDN / phone number, or exhibit ID..."
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

          {/* Frequency Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
            <Filter size={12} className="text-amber-400" />
            <select
              value={minFrequency}
              onChange={(e) => setMinFrequency(Number(e.target.value))}
              className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer font-mono"
            >
              <option value={1} className="bg-slate-900 text-slate-300">All Interactions (1+)</option>
              <option value={4} className="bg-slate-900 text-amber-300 font-semibold">Medium Traffic (4+ calls)</option>
              <option value={8} className="bg-slate-900 text-rose-300 font-semibold">Frequent Contact (8+ calls)</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400">
          <span className="text-sky-300 font-bold text-glow-sky">{filtered.length}</span> Communication Traces Indexed
        </div>
      </div>

      {/* ── Active Scope Banner ── */}
      {(selectedCaseId || selectedEntityId) && (
        <div className="px-6 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase text-sky-400 font-semibold">Active Scope:</span>
            {selectedCaseId && (
              <span className="badge bg-sky-950/80 border-sky-700 text-sky-300 text-[10px] font-mono">
                Case: {selectedCaseObj?.case_number || selectedCaseId.slice(0, 8)}
              </span>
            )}
            {selectedEntityId && (
              <span className="badge bg-purple-950/80 border-purple-700 text-purple-300 text-[10px] font-mono">
                Entity Scoped: {selectedEntityId.slice(0, 8)}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setSelectedCaseId("");
              setSelectedEntityId("");
              setSearchParams({});
            }}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
          >
            <X size={12} />
            <span>Clear Filter Context</span>
          </button>
        </div>
      )}

      {/* ── Main Data View ── */}
      <div className="flex-1 p-6 overflow-y-auto space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-20 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel p-12 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-panel-solid)] rounded-lg">
            <PhoneCall size={32} className="mx-auto mb-2 opacity-30 text-sky-400" />
            <div className="font-semibold text-[var(--text-secondary)] uppercase">No communication records matched</div>
            <p className="mt-1 text-[11px] text-slate-400">
              {selectedEntityId || selectedCaseId
                ? "No communication records found for this active scope."
                : "Adjust search query or frequency filter."}
            </p>
          </div>
        ) : viewMode === "matrix" ? (
          /* ── Topology / Matrix View: Caller -> Call -> Receiver ── */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filtered.map((item) => {
              const isFrequent = (item.frequency_count || 1) >= 8;
              const isMedium = (item.frequency_count || 1) >= 4;

              return (
                <div
                  key={item.id}
                  className={`panel p-4 rounded-lg border transition-all space-y-3 ${
                    isFrequent
                      ? "bg-gradient-to-br from-rose-950/20 via-slate-900/90 to-slate-900 border-rose-500/50 shadow-md"
                      : isMedium
                      ? "bg-gradient-to-br from-amber-950/20 via-slate-900/90 to-slate-900 border-amber-500/50 shadow-sm"
                      : "bg-gradient-to-br from-sky-950/10 via-slate-900/90 to-slate-900 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-slate-800 border border-slate-700 text-slate-300">
                        {item.source_evidence}
                      </span>
                      {isFrequent && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-600/60 flex items-center gap-1">
                          <Radio size={9} className="animate-pulse text-rose-400" />
                          <span>HIGH FREQUENCY</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Flow: Caller -> Bridge -> Receiver */}
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                    {/* Originating Party */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-mono uppercase text-sky-400 font-semibold">Originating Party</div>
                      <div
                        onClick={() => navigate(`/network?entity_id=${item.caller_id}`)}
                        className="text-xs font-bold text-slate-100 hover:text-sky-300 cursor-pointer truncate transition-colors"
                        title={item.caller_name}
                      >
                        {item.caller_name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">{item.caller_phone}</div>
                    </div>

                    {/* Middle Telephony Bridge */}
                    <div className="flex flex-col items-center justify-center px-2">
                      <div className="w-7 h-7 rounded-full bg-sky-950 border border-sky-600/80 flex items-center justify-center text-sky-400 shadow-sm">
                        <PhoneCall size={12} />
                      </div>
                      <div className="text-[11px] font-mono font-bold text-amber-300 mt-1">
                        {item.frequency_count} calls
                      </div>
                      <div className="text-[8px] font-mono text-slate-400">
                        {Math.floor(item.duration_seconds / 60)}m avg
                      </div>
                    </div>

                    {/* Terminating Party */}
                    <div className="flex-1 min-w-0 text-right">
                      <div className="text-[9px] font-mono uppercase text-purple-400 font-semibold">Terminating Party</div>
                      <div
                        onClick={() => navigate(`/network?entity_id=${item.receiver_id}`)}
                        className="text-xs font-bold text-slate-100 hover:text-sky-300 cursor-pointer truncate transition-colors"
                        title={item.receiver_name}
                      >
                        {item.receiver_name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">{item.receiver_phone}</div>
                    </div>
                  </div>

                  {/* Pivot Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800 text-xs">
                    <button
                      onClick={() => navigate(`/timeline?entity_id=${item.caller_id}`)}
                      className="flex items-center gap-1 text-[10px] font-mono text-slate-300 hover:text-sky-300 bg-slate-800/80 px-2 py-1 rounded border border-slate-700 cursor-pointer transition-colors"
                    >
                      <Clock size={11} />
                      <span>Timeline</span>
                    </button>
                    <button
                      onClick={() => navigate(`/network?entity_id=${item.caller_id}`)}
                      className="flex items-center gap-1 text-[10px] font-mono text-sky-400 hover:text-sky-300 bg-sky-950/60 px-2 py-1 rounded border border-sky-800/80 cursor-pointer font-semibold transition-colors"
                    >
                      <Network size={11} />
                      <span>Explore Network</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Standard CDR Feed List View (Strict 12-Column Alignment) ── */
          <div className="space-y-2">
            {/* Header Bar */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-10 py-2.5 bg-slate-950 border-b border-slate-800/80 text-[10px] font-mono uppercase tracking-wider text-slate-400 select-none">
              <div className="col-span-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span>Originating Party (Caller)</span>
              </div>
              <div className="col-span-2 text-center">Telemetry & Intensity</div>
              <div className="col-span-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                <span>Terminating Party (Receiver)</span>
              </div>
              <div className="col-span-2 text-right">Duration & Timing</div>
              <div className="col-span-1 text-center">Exhibit</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {/* List Rows */}
            {filtered.map((item) => {
              const isFrequent = (item.frequency_count || 1) >= 8;
              const isMedium = (item.frequency_count || 1) >= 4;

              return (
                <div
                  key={item.id}
                  className={`panel p-3.5 rounded-lg border transition-all ${
                    isFrequent
                      ? "bg-gradient-to-r from-rose-950/20 via-slate-900/90 to-slate-900 border-l-4 border-l-rose-500 border-slate-800 hover:border-rose-500/50 shadow-sm"
                      : isMedium
                      ? "bg-gradient-to-r from-amber-950/15 via-slate-900/90 to-slate-900 border-l-4 border-l-amber-500 border-slate-800 hover:border-amber-500/50 shadow-sm"
                      : "bg-gradient-to-r from-sky-950/10 via-slate-900/90 to-slate-900 border-l-4 border-l-sky-500/70 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-center">
                    
                    {/* Originating Party / Caller (Col 1-3) */}
                    <div className="lg:col-span-3 flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-sky-950/90 border border-sky-700/60 text-sky-400 flex items-center justify-center shrink-0 shadow-inner">
                        <PhoneCall size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-mono text-slate-400 uppercase lg:hidden">
                          Originating Party
                        </div>
                        <div
                          onClick={() =>
                            navigate(
                              `/network?entity_id=${item.caller_id}${
                                selectedCaseId ? `&case_id=${selectedCaseId}` : ""
                              }`
                            )
                          }
                          className="text-xs font-bold text-slate-100 hover:text-sky-400 cursor-pointer truncate transition-colors"
                          title={item.caller_name}
                        >
                          {item.caller_name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          {item.caller_phone}
                        </div>
                      </div>
                    </div>

                    {/* Telemetry Channel & Intensity (Col 4-5) */}
                    <div className="lg:col-span-2 flex flex-col items-start lg:items-center justify-center">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full border ${
                            isFrequent
                              ? "bg-rose-950/80 text-rose-300 border-rose-600/60"
                              : isMedium
                              ? "bg-amber-950/80 text-amber-300 border-amber-600/60"
                              : "bg-sky-950/80 text-sky-300 border-sky-700/60"
                          }`}
                        >
                          {item.frequency_count} Calls
                        </span>
                      </div>
                      {/* Mini visual intensity meter */}
                      <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5 hidden lg:block">
                        <div
                          className={`h-full rounded-full ${
                            isFrequent
                              ? "bg-rose-500"
                              : isMedium
                              ? "bg-amber-500"
                              : "bg-sky-500"
                          }`}
                          style={{
                            width: `${Math.min(100, ((item.frequency_count || 1) / 12) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Terminating Party / Receiver (Col 6-8) */}
                    <div className="lg:col-span-3 flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-purple-950/90 border border-purple-700/60 text-purple-400 flex items-center justify-center shrink-0 shadow-inner">
                        <PhoneCall size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-mono text-slate-400 uppercase lg:hidden">
                          Terminating Party
                        </div>
                        <div
                          onClick={() =>
                            navigate(
                              `/network?entity_id=${item.receiver_id}${
                                selectedCaseId ? `&case_id=${selectedCaseId}` : ""
                              }`
                            )
                          }
                          className="text-xs font-bold text-slate-100 hover:text-sky-400 cursor-pointer truncate transition-colors"
                          title={item.receiver_name}
                        >
                          {item.receiver_name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          {item.receiver_phone}
                        </div>
                      </div>
                    </div>

                    {/* Duration & Timing (Col 9-10) */}
                    <div className="lg:col-span-2 text-left lg:text-right font-mono text-[10px] text-slate-300">
                      <div className="text-[10px] font-mono text-slate-400 uppercase lg:hidden">
                        Timing
                      </div>
                      <div className="font-semibold text-slate-200">
                        {Math.floor(item.duration_seconds / 60)}m {item.duration_seconds % 60}s avg
                      </div>
                      <div className="text-slate-400">
                        {new Date(item.timestamp).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>

                    {/* Exhibit (Col 11) */}
                    <div className="lg:col-span-1 flex items-center justify-start lg:justify-center">
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-slate-800/90 border border-slate-700 text-slate-300 truncate max-w-[105px]">
                        {item.source_evidence}
                      </span>
                    </div>

                    {/* Actions (Col 12) */}
                    <div className="lg:col-span-1 flex items-center justify-end gap-1.5">
                      <button
                        onClick={() =>
                          navigate(
                            `/timeline?entity_id=${item.caller_id}${
                              selectedCaseId ? `&case_id=${selectedCaseId}` : ""
                            }`
                          )
                        }
                        className="p-1.5 rounded-md bg-slate-800/90 border border-slate-700 hover:border-sky-400 hover:bg-sky-950/60 text-slate-300 hover:text-sky-300 transition-all cursor-pointer shadow-sm"
                        title="View in Chronological Timeline"
                      >
                        <Clock size={12} />
                      </button>
                      <button
                        onClick={() =>
                          navigate(
                            `/network?entity_id=${item.caller_id}${
                              selectedCaseId ? `&case_id=${selectedCaseId}` : ""
                            }`
                          )
                        }
                        className="p-1.5 rounded-md bg-slate-800/90 border border-slate-700 hover:border-sky-400 hover:bg-sky-950/60 text-slate-300 hover:text-sky-300 transition-all cursor-pointer shadow-sm"
                        title="View in Network Graph"
                      >
                        <ChevronRight size={12} />
                      </button>
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
