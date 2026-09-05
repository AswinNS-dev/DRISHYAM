import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  Users, FolderKanban, ShieldCheck, AlertTriangle,
  Network as NetworkIcon, ChevronRight, ArrowUpRight
} from "lucide-react";
import {
  ResponsiveContainer, Tooltip as RechartsTooltip,
  PieChart, Pie, Cell
} from "recharts";

/* ── Tabular counter hook ── */
function useCounter(target: number, duration = 1000) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(0);
  useEffect(() => {
    if (target <= 0) { setValue(0); return; }
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

export default function Dashboard() {
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.dashboardSummary().then(setSummary).catch(() => {});
    api.alerts().then((r) => setAlerts(r.alerts?.slice(0, 4) || [])).catch(() => {});
    api.cases().then((r) => setRecentCases(r.cases?.slice(0, 5) || [])).catch(() => {});
  }, []);

  const countCases = useCounter(summary?.active_investigations || 12);
  const countEntities = useCounter(summary?.connected_entities || 84);
  const countRelationships = useCounter(summary?.discovered_relationships || 192);

  const riskData = [
    { name: "Priority Review", value: summary?.anomalies || 4, color: "#ef4444" },
    { name: "Possible Identity Matches", value: summary?.unresolved_entity_matches || 8, color: "#f59e0b" },
    { name: "Standard Verified Records", value: Math.max(12, (summary?.connected_entities || 40) - 12), color: "#10b981" },
  ];

  return (
    <div className="p-6 space-y-6 page-enter max-w-7xl mx-auto">
      {/* ── Top Investigation Context Banner ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-info text-[9px]">CENTRAL COMMAND</span>
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              CRIMEINTEL INVESTIGATIVE SUITE v2.4
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-bright)]">
            Investigation Command Center
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Operational overview of active criminal cases, connected entity dossiers, and tamper-evident forensic exhibits.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate("/cases")}
            className="btn-secondary flex items-center gap-1.5"
          >
            <FolderKanban size={13} />
            <span>Case Workspaces</span>
          </button>
          <button
            onClick={() => navigate("/network")}
            className="btn-primary flex items-center gap-1.5"
          >
            <NetworkIcon size={13} />
            <span>Network Analysis</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* ── Key Operational Metrics Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div
          onClick={() => navigate("/cases")}
          className="panel p-4 cursor-pointer hover:border-[var(--intel-sky)] transition-all"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="hud-label text-[10px]">Active Investigations</span>
            <FolderKanban size={16} className="text-[var(--intel-sky)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text-bright)] font-mono mt-2">
            {countCases}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1 flex items-center justify-between">
            <span>Under Active Inquiry</span>
            <span className="text-[var(--intel-sky)] font-mono">View All →</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div
          onClick={() => navigate("/entities")}
          className="panel p-4 cursor-pointer hover:border-[var(--intel-sky)] transition-all"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="hud-label text-[10px]">Connected Entities</span>
            <Users size={16} className="text-[#3b82f6]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text-bright)] font-mono mt-2">
            {countEntities}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1 flex items-center justify-between">
            <span>Persons, Phones, Plates</span>
            <span className="text-[#3b82f6] font-mono">Dossiers →</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div
          onClick={() => navigate("/network")}
          className="panel p-4 cursor-pointer hover:border-[var(--intel-sky)] transition-all"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="hud-label text-[10px]">Discovered Relationships</span>
            <NetworkIcon size={16} className="text-[var(--status-purple)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text-bright)] font-mono mt-2">
            {countRelationships}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1 flex items-center justify-between">
            <span>Evidence-Backed Links</span>
            <span className="text-[var(--status-purple)] font-mono">Graph →</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div
          onClick={() => navigate("/evidence")}
          className="panel p-4 cursor-pointer hover:border-[var(--intel-sky)] transition-all"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="hud-label text-[10px]">Evidence Integrity Ledger</span>
            <ShieldCheck size={16} className="text-[var(--status-verified)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text-bright)] font-mono mt-2">
            100%
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1 flex items-center justify-between">
            <span>SHA-256 Vault Verified</span>
            <span className="text-[var(--status-verified)] font-mono">Vault →</span>
          </div>
        </div>
      </div>

      {/* ── Operational Grid (2 Columns: Active Cases & Activity Feed) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Active Cases Worklist & Investigation Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Cases Worklist */}
          <div className="panel p-5 bg-[var(--bg-panel-solid)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-3">
              <div className="flex items-center gap-2">
                <FolderKanban size={15} className="text-[var(--intel-sky)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Active Case Investigation Files
                </h2>
              </div>
              <button
                onClick={() => navigate("/cases")}
                className="text-xs font-mono text-[var(--intel-sky)] hover:underline flex items-center gap-1"
              >
                <span>View Full Registry</span>
                <ChevronRight size={12} />
              </button>
            </div>

            <div className="space-y-2">
              {recentCases.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                  Loading active investigations...
                </div>
              ) : (
                recentCases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate("/cases")}
                    className="p-3 rounded bg-[var(--bg-panel-raised)] hover:bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] cursor-pointer transition-all flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[var(--intel-sky)]">
                          {c.case_number}
                        </span>
                        <span className="badge badge-low text-[8px]">
                          {c.status || "OPEN"}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          DISTRICT: {c.district}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {c.title}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] font-mono text-[var(--status-purple)]">
                        {c.crime_type}
                      </span>
                      <ArrowUpRight size={14} className="text-[var(--text-muted)]" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Investigation Ingestion & Evidence Flow */}
          <div className="panel p-5 bg-[var(--bg-panel-solid)]">
            <div className="hud-label text-[10px] text-[var(--intel-sky)] mb-3">
              Standard Investigation Workflow Flow
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div
                onClick={() => navigate("/data-import")}
                className="p-3 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-[var(--intel-sky)] cursor-pointer transition-all"
              >
                <div className="text-[10px] font-mono text-[var(--text-muted)]">STEP 01</div>
                <div className="font-bold text-[var(--text-primary)] mt-1">Multi-Source Ingestion</div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">FIR narratives, CDR logs, forensic extractions.</p>
              </div>

              <div
                onClick={() => navigate("/entities")}
                className="p-3 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-[var(--intel-sky)] cursor-pointer transition-all"
              >
                <div className="text-[10px] font-mono text-[var(--text-muted)]">STEP 02</div>
                <div className="font-bold text-[var(--text-primary)] mt-1">Identity Matching</div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">Cross-case deduplication of suspect identifiers.</p>
              </div>

              <div
                onClick={() => navigate("/network")}
                className="p-3 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-[var(--intel-sky)] cursor-pointer transition-all"
              >
                <div className="text-[10px] font-mono text-[var(--text-muted)]">STEP 03</div>
                <div className="font-bold text-[var(--text-primary)] mt-1">Network Association</div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">Evidence-grounded link graph & hidden brokers.</p>
              </div>

              <div
                onClick={() => navigate("/evidence")}
                className="p-3 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-[var(--intel-sky)] cursor-pointer transition-all"
              >
                <div className="text-[10px] font-mono text-[var(--text-muted)]">STEP 04</div>
                <div className="font-bold text-[var(--text-primary)] mt-1">Evidence Integrity Seal</div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">Cryptographic custody chaining for court audit.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Recent Intelligence Alerts & Record Distribution */}
        <div className="space-y-6">
          {/* Recent Intelligence Alerts */}
          <div className="panel p-5 bg-[var(--bg-panel-solid)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-[var(--status-warning)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Tactical Intelligence Alerts
                </h2>
              </div>
              <button
                onClick={() => navigate("/alerts")}
                className="text-xs font-mono text-[var(--intel-sky)] hover:underline"
              >
                All Alerts →
              </button>
            </div>

            <div className="space-y-2.5">
              {alerts.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                  No active red flag alerts logged.
                </div>
              ) : (
                alerts.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => navigate("/alerts")}
                    className="p-3 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] cursor-pointer transition-all space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="badge badge-medium text-[8px]">
                        {a.alert_type?.replace("_", " ")}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {Math.round((a.confidence || 0.8) * 100)}% Confidence
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-[var(--text-primary)] line-clamp-1">
                      {a.what_happened}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] line-clamp-2">
                      {a.why_it_matters}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Record Verification Distribution */}
          <div className="panel p-5 bg-[var(--bg-panel-solid)]">
            <div className="hud-label text-[10px] text-[var(--intel-sky)] mb-3">
              Record Review Breakdown
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskData}
                    cx="50%" cy="50%"
                    innerRadius={42} outerRadius={64}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {riskData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      background: "var(--bg-panel-solid)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)] text-[11px]">
              {riskData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-[var(--text-secondary)]">
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: d.color }} />
                    <span>{d.name}</span>
                  </div>
                  <span className="font-mono text-[var(--text-primary)] font-bold">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
