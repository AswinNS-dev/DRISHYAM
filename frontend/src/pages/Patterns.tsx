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
    <div className="flex flex-col h-full bg-[var(--bg-void)]">
      {/* ── Top Header Strip ── */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-panel-solid)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
            <AlertTriangle size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold tracking-wide uppercase text-[var(--text-primary)]">
                Patterns & Behavioral Anomalies
              </h1>
              <span className="badge badge-low text-[8px]">AI-ASSISTED FINDINGS</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Algorithmic detection of unusual communication bursts, cross-district conduits, and syndicate hubs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadPatterns}
            className="p-1.5 rounded border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-panel-raised)] transition-all"
            title="Refresh Anomalies"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[var(--intel-sky)]" : ""} />
          </button>
        </div>
      </div>

      {/* Mandatory Notice */}
      <div className="px-6 py-2.5 bg-[rgba(245,158,11,0.06)] border-b border-[rgba(245,158,11,0.2)] text-[11px] text-[var(--text-secondary)] flex items-center gap-2">
        <ShieldAlert size={13} className="text-[var(--status-warning)] shrink-0" />
        <span>
          <strong>OFFICER EVALUATION STANDARD:</strong> Flagged patterns represent algorithmic deviations from baseline and require independent corroboration. Do not treat as factual culpability.
        </span>
      </div>

      {/* ── Metric Highlights Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Flagged Anomalies</div>
          <div className="text-base font-bold font-mono text-[var(--status-warning)] mt-0.5">{anomalies.length}</div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Cross-Case Links</div>
          <div className="text-base font-bold font-mono text-[var(--status-purple)] mt-0.5">
            {insights?.cross_case_links || 0}
          </div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Detected Communities</div>
          <div className="text-base font-bold font-mono text-[var(--intel-sky)] mt-0.5">
            {insights?.communities || 0}
          </div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Unresolved Matches</div>
          <div className="text-base font-bold font-mono text-[var(--text-bright)] mt-0.5">
            {insights?.unresolved_entity_matches || 0}
          </div>
        </div>
      </div>

      {/* ── Filter Strip ── */}
      <div className="px-6 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search size={12} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by subject name, deviation type, or pattern narrative..."
              className="workstation-input pl-8 pr-3 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded px-2.5 py-1">
            <Filter size={12} className="text-[var(--text-muted)]" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-transparent text-xs text-[var(--text-secondary)] outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-[var(--bg-panel-solid)]">All Severities</option>
              <option value="HIGH" className="bg-[var(--bg-panel-solid)]">High Priority (Critical Deviation)</option>
              <option value="MEDIUM" className="bg-[var(--bg-panel-solid)]">Medium Priority</option>
              <option value="LOW" className="bg-[var(--bg-panel-solid)]">Routine Advisory</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] font-mono text-[var(--text-muted)]">
          {filtered.length} Discovered Patterns
        </div>
      </div>

      {/* ── Pattern List ── */}
      <div className="flex-1 p-6 overflow-y-auto space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-24 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel p-12 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-panel-solid)]">
            <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30 text-[var(--status-verified)]" />
            <div className="font-semibold text-[var(--text-secondary)] uppercase">No anomalies in current filter</div>
            <p className="mt-1 text-[11px]">All indexed entities match baseline activity models.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const isReviewed = reviewedMap[item.id];

              return (
                <div
                  key={item.id}
                  className={`panel p-4 bg-[var(--bg-panel-solid)] hover:border-[var(--border-strong)] transition-all ${
                    item.severity === "high" ? "border-l-2 border-l-[var(--status-critical)]" : ""
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge badge-high text-[9px]">
                          {item.anomaly_type?.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          Subject: {item.entity_name}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          ID: {item.entity_id}
                        </span>
                        {item.severity && (
                          <span
                            className={`badge text-[8px] uppercase ${
                              item.severity === "high" ? "badge-critical" : "badge-medium"
                            }`}
                          >
                            {item.severity} SEVERITY
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {item.reason}
                      </p>

                      {item.related_entities && item.related_entities.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] pt-1 flex-wrap">
                          <Users size={12} />
                          <span>Connected Sub-Entities:</span>
                          {item.related_entities.map((re: string, i: number) => (
                            <span
                              key={i}
                              onClick={() => navigate(`/entities?q=${encodeURIComponent(re)}`)}
                              className="px-1.5 py-0.5 rounded bg-[var(--bg-panel-raised)] text-[var(--intel-sky)] font-mono text-[10px] hover:underline cursor-pointer"
                            >
                              {re}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--border-subtle)]">
                      <button
                        onClick={() => handleMarkReviewed(item.id)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                          isReviewed
                            ? "bg-[var(--bg-panel-raised)] text-[var(--status-verified)] border border-[var(--status-verified)]"
                            : "btn-secondary text-[11px]"
                        }`}
                      >
                        {isReviewed ? "Reviewed ✓" : "Mark Under Review"}
                      </button>

                      <button
                        onClick={() => navigate(`/entities?q=${encodeURIComponent(item.entity_name)}`)}
                        className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1"
                      >
                        <span>Open Dossier</span>
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
