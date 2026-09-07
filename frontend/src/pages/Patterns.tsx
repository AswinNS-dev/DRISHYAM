import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  AlertTriangle, Search, Filter, RefreshCw, ShieldAlert,
  Users, ChevronRight, CheckCircle2
} from "lucide-react";

export default function Patterns() {
  const navigate = useNavigate();
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [reviewedMap, setReviewedMap] = useState<Record<string, boolean>>({});

  function loadPatterns() {
    setLoading(true);
    Promise.all([
      api.anomalies().catch(() => ({ anomalies: [] })),
      api.insights().catch(() => null),
    ]).then(([anomRes, insRes]) => {
      setAnomalies(anomRes.anomalies || []);
      setInsights(insRes);
      setLoading(false);
    });
  }

  useEffect(() => {
    loadPatterns();
  }, []);

  function handleMarkReviewed(id: string) {
    setReviewedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const filtered = anomalies.filter((a) => {
    const matchesSearch =
      !search ||
      a.entity_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.anomaly_type?.toLowerCase().includes(search.toLowerCase()) ||
      a.reason?.toLowerCase().includes(search.toLowerCase());

    const matchesSeverity = severityFilter === "ALL" || (a.severity || "medium").toUpperCase() === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="flex flex-col h-full bg-[#020617]">
      {/* ── Top Header Strip ── */}
      <div className="px-6 py-4 border-b border-slate-800/90 space-y-3 bg-slate-900/95 backdrop-blur-md">
        {/* Module Metadata Line */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge badge-info text-xs font-mono tracking-wider font-bold py-0.5 px-2 bg-slate-800 text-sky-300 border border-sky-500/30">
              STATE PATTERN DISCOVERY & ANOMALY DETECTION
            </span>
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE DATABASE SYNCHRONIZED
            </span>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Detected Deviations: <span className="text-white font-bold">{filtered.length}</span> Active Pattern Records
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-400 border border-slate-800 flex items-center justify-center shadow-md">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase text-white">
                  Patterns & Behavioral Anomalies
                </h1>
                <span className="badge badge-low text-xs font-mono font-bold bg-amber-950/60 text-amber-300 border-amber-800/60">
                  AI-ASSISTED FINDINGS
                </span>
              </div>
              <p className="text-sm text-slate-300 font-medium">
                Algorithmic detection of unusual communication bursts, cross-district conduits, and syndicate hubs
              </p>
            </div>
          </div>

          <button
            onClick={loadPatterns}
            className="p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white bg-slate-950 transition-all cursor-pointer shadow-sm"
            title="Refresh Anomalies"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-sky-400" : ""} />
          </button>
        </div>
      </div>

      {/* Mandatory Notice */}
      <div className="px-6 py-3 bg-amber-950/20 border-b border-amber-500/30 text-xs md:text-sm text-amber-200/90 flex items-center gap-2.5">
        <ShieldAlert size={16} className="text-amber-400 shrink-0" />
        <span>
          <strong className="text-amber-300 font-bold">OFFICER EVALUATION STANDARD:</strong> Flagged patterns represent algorithmic deviations from baseline and require independent corroboration. Do not treat as factual culpability.
        </span>
      </div>

      {/* ── Metric Highlights Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3.5 border-b border-slate-800/90 bg-slate-900/90">
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="text-xs font-mono text-amber-400 uppercase tracking-wider font-bold">Flagged Anomalies</div>
          <div className="text-2xl md:text-3xl font-black font-mono text-amber-300 mt-1">{anomalies.length}</div>
        </div>
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="text-xs font-mono text-purple-400 uppercase tracking-wider font-bold">Cross-Case Links</div>
          <div className="text-2xl md:text-3xl font-black font-mono text-purple-300 mt-1">
            {insights?.cross_case_links || 0}
          </div>
        </div>
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="text-xs font-mono text-sky-400 uppercase tracking-wider font-bold">Detected Communities</div>
          <div className="text-2xl md:text-3xl font-black font-mono text-sky-300 mt-1">
            {insights?.communities || 0}
          </div>
        </div>
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-bold">Unresolved Matches</div>
          <div className="text-2xl md:text-3xl font-black font-mono text-cyan-300 mt-1">
            {insights?.unresolved_entity_matches || 0}
          </div>
        </div>
      </div>

      {/* ── Filter Strip ── */}
      <div className="px-6 py-3 border-b border-slate-800/90 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by subject name, deviation type, or pattern narrative..."
              className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
            <Filter size={14} className="text-amber-400" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-transparent text-xs md:text-sm text-slate-200 outline-none cursor-pointer font-mono"
            >
              <option value="ALL" className="bg-slate-900 text-slate-200">All Severities</option>
              <option value="HIGH" className="bg-slate-900 text-rose-300 font-semibold">High Priority (Critical Deviation)</option>
              <option value="MEDIUM" className="bg-slate-900 text-amber-300 font-semibold">Medium Priority</option>
              <option value="LOW" className="bg-slate-900 text-slate-300">Routine Advisory</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400">
          <span className="text-amber-300 font-bold">{filtered.length}</span> Discovered Patterns
        </div>
      </div>

      {/* ── Pattern List ── */}
      <div className="flex-1 p-6 overflow-y-auto space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 rounded-xl text-center text-sm text-slate-400 bg-slate-900/95 border border-slate-800/90 shadow-xl">
            <CheckCircle2 size={36} className="mx-auto mb-2 opacity-30 text-emerald-400" />
            <div className="font-bold text-base text-slate-200 uppercase font-mono">No anomalies in current filter</div>
            <p className="mt-1 text-xs text-slate-400">All indexed entities match baseline activity models.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const isReviewed = reviewedMap[item.id];

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl bg-slate-900/95 border border-slate-800/90 hover:border-slate-700 transition-all shadow-xl ${
                    item.severity === "high" ? "border-l-4 border-l-rose-500" : ""
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="badge badge-high text-xs font-mono font-bold">
                          {item.anomaly_type?.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm md:text-base font-bold text-white">
                          Subject: {item.entity_name}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          ID: {item.entity_id}
                        </span>
                        {item.severity && (
                          <span
                            className={`badge text-xs font-mono font-bold uppercase ${
                              item.severity === "high" ? "badge-critical" : "badge-medium"
                            }`}
                          >
                            {item.severity} SEVERITY
                          </span>
                        )}
                      </div>

                      <p className="text-sm md:text-base text-slate-200 leading-relaxed font-normal">
                        {item.reason}
                      </p>

                      {item.related_entities && item.related_entities.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-slate-400 pt-1 flex-wrap font-semibold">
                          <Users size={14} className="text-sky-400" />
                          <span>Connected Sub-Entities:</span>
                          {item.related_entities.map((re: string, i: number) => (
                            <span
                              key={i}
                              onClick={() => navigate(`/entities?q=${encodeURIComponent(re)}`)}
                              className="px-2.5 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-sky-300 font-mono text-xs font-bold hover:border-sky-500 cursor-pointer shadow-sm transition-colors"
                            >
                              {re}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                      <button
                        onClick={() => handleMarkReviewed(item.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm ${
                          isReviewed
                            ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/40"
                            : "btn-secondary text-xs border-slate-800 bg-slate-950 text-slate-300"
                        }`}
                      >
                        {isReviewed ? "Reviewed ✓" : "Mark Under Review"}
                      </button>

                      <button
                        onClick={() => navigate(`/entities?q=${encodeURIComponent(item.entity_name)}`)}
                        className="btn-primary py-1.5 px-3 text-xs md:text-sm flex items-center gap-1 font-mono font-bold"
                      >
                        <span>Open Dossier</span>
                        <ChevronRight size={14} />
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
