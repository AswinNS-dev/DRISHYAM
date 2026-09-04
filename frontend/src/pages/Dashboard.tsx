import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  AlertTriangle, GitBranch, Link2, Shield, Users,
  Network as NetworkIcon, Activity, Zap, ChevronRight, Eye
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip as RechartsTooltip,
  AreaChart, Area
} from "recharts";

/* ── Animated counter hook ── */
function useCounter(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(0);
  useEffect(() => {
    if (target <= 0) { setValue(0); return; }
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);
  return value;
}

const STAT_CARDS = [
  { key: "active_investigations", label: "Active Investigations", icon: Shield, color: "#5b8def", glow: "rgba(91,141,239,0.15)" },
  { key: "connected_entities", label: "Connected Entities", icon: Users, color: "#2dd4bf", glow: "rgba(45,212,191,0.15)" },
  { key: "discovered_relationships", label: "Relationships", icon: Link2, color: "#a855f7", glow: "rgba(168,85,247,0.15)" },
  { key: "unresolved_entity_matches", label: "Unresolved Matches", icon: GitBranch, color: "#fbbf24", glow: "rgba(251,191,36,0.15)" },
  { key: "high_confidence_leads", label: "High-Confidence Leads", icon: Zap, color: "#34d399", glow: "rgba(52,211,153,0.15)" },
  { key: "anomalies", label: "Anomalies Detected", icon: AlertTriangle, color: "#ff3b5c", glow: "rgba(255,59,92,0.15)" },
  { key: "cross_case_links", label: "Cross-Case Links", icon: Activity, color: "#5b8def", glow: "rgba(91,141,239,0.15)" },
  { key: "network_communities", label: "Network Communities", icon: NetworkIcon, color: "#a855f7", glow: "rgba(168,85,247,0.15)" },
];

const PIPELINE_STEPS = [
  "Multi-source ingestion (FIR / CDR / Financial / Surveillance)",
  "NLP entity extraction with confidence scoring",
  "Entity resolution & deduplication",
  "Relationship extraction with provenance",
  "Evidence-backed graph construction",
  "Centrality, community & hidden-link discovery",
  "Anomaly detection (z-score / burst analysis)",
  "Dossier 360 & evidence-grounded AI leads",
];

export default function Dashboard() {
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.dashboardSummary().then(setSummary).catch(() => {});
    api.alerts().then((r) => setAlerts(r.alerts.slice(0, 4))).catch(() => {});
  }, []);

  // Mock chart data derived from summary
  const radarData = summary ? [
    { subject: "Persons", value: summary.connected_entities || 0, max: 100 },
    { subject: "Relationships", value: summary.discovered_relationships || 0, max: 500 },
    { subject: "Cases", value: summary.active_investigations || 0, max: 30 },
    { subject: "Anomalies", value: summary.anomalies || 0, max: 20 },
    { subject: "Communities", value: summary.network_communities || 0, max: 15 },
  ] : [];

  const riskData = [
    { name: "High", value: summary?.anomalies || 3, color: "#ff3b5c" },
    { name: "Medium", value: summary?.unresolved_entity_matches || 8, color: "#fbbf24" },
    { name: "Low", value: (summary?.connected_entities || 20) - (summary?.anomalies || 3) - (summary?.unresolved_entity_matches || 8), color: "#2dd4bf" },
  ];

  const activityData = Array.from({ length: 14 }, (_, i) => ({
    day: `D-${14 - i}`,
    value: Math.floor(Math.random() * 12 + 3 + (i > 10 ? 8 : 0)),
  }));

  return (
    <div className="p-6 space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-3">
            <Eye size={22} color="var(--neon-teal)" style={{ filter: "drop-shadow(0 0 8px rgba(0,255,255,0.3))" }} />
            <span className="neon-text-subtle" style={{ color: "var(--text-bright)" }}>
              Network Intelligence Overview
            </span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Fragmented records transformed into an evidence-backed criminal network.
          </p>
        </div>
        <button onClick={() => navigate("/network")} className="btn-primary flex items-center gap-2">
          <NetworkIcon size={14} />
          Open Network
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 stagger-in">
        {STAT_CARDS.map(({ key, label, icon: Icon, color, glow }) => {
          const rawValue = summary?.[key] ?? 0;
          const displayValue = useCounter(rawValue);
          return (
            <div key={key} className="glass-panel p-4 hover-lift" style={{ cursor: "default" }}>
              <div className="flex items-center justify-between mb-3">
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: glow,
                    boxShadow: `0 0 16px ${glow}`,
                  }}
                >
                  <Icon size={18} color={color} />
                </div>
              </div>
              <div className="counter-value text-2xl font-bold" style={{ color: "var(--text-bright)" }}>
                {summary ? displayValue : "—"}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{label}</div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-5">
        {/* Radar Chart */}
        <div className="glass-panel p-5">
          <div className="hud-label mb-3" style={{ color: "var(--neon-teal)", fontSize: 10 }}>
            Network Composition
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(45,212,191,0.1)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
              <Radar dataKey="value" stroke="#2dd4bf" fill="rgba(45,212,191,0.15)" strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Donut */}
        <div className="glass-panel p-5">
          <div className="hud-label mb-3" style={{ color: "var(--neon-teal)", fontSize: 10 }}>
            Risk Distribution
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={riskData}
                cx="50%" cy="50%"
                innerRadius={50} outerRadius={75}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {riskData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} style={{ filter: `drop-shadow(0 0 6px ${entry.color})` }} />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={{
                  background: "var(--bg-panel-solid)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {riskData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} />
                <span className="hud-label" style={{ fontSize: 9 }}>{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Sparkline */}
        <div className="glass-panel p-5">
          <div className="hud-label mb-3" style={{ color: "var(--neon-teal)", fontSize: 10 }}>
            Recent Activity (14 days)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={activityData}>
              <defs>
                <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: "var(--text-muted)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <RechartsTooltip
                contentStyle={{
                  background: "var(--bg-panel-solid)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone" dataKey="value"
                stroke="#2dd4bf" strokeWidth={2}
                fill="url(#activityGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#0ff", stroke: "#0ff", strokeWidth: 1 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <div className="glass-panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="hud-label" style={{ color: "var(--neon-teal)", fontSize: 10 }}>
              Recent Intelligence Alerts
            </div>
            <button onClick={() => navigate("/alerts")}
              className="text-xs font-medium transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neon-teal)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
              View all →
            </button>
          </div>
          <div className="space-y-3">
            {alerts.map((a) => {
              const severityColor = a.confidence > 0.85 ? "neon-border-left-red"
                : a.confidence > 0.6 ? "neon-border-left-amber" : "neon-border-left";
              return (
                <div key={a.id} className={`panel p-3 ${severityColor}`} style={{ borderRadius: 8 }}>
                  <div className="flex items-center justify-between">
                    <span className="badge badge-medium" style={{ fontSize: 9 }}>
                      {a.alert_type.replaceAll("_", " ")}
                    </span>
                    <span className="hud-label" style={{ fontSize: 8 }}>
                      {Math.round(a.confidence * 100)}%
                    </span>
                  </div>
                  <div className="text-sm mt-1.5 font-medium">{a.what_happened}</div>
                </div>
              );
            })}
            {alerts.length === 0 && (
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>No alerts yet.</div>
            )}
          </div>
        </div>

        {/* Investigation Pipeline */}
        <div className="glass-panel p-5">
          <div className="hud-label mb-4" style={{ color: "var(--neon-teal)", fontSize: 10 }}>
            Investigation Pipeline
          </div>
          <div className="space-y-2.5">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{
                    background: "rgba(45,212,191,0.1)",
                    border: "1px solid rgba(45,212,191,0.25)",
                    color: "var(--neon-teal)",
                    fontFamily: "var(--font-mono)",
                    boxShadow: "0 0 8px rgba(0,255,255,0.08)",
                  }}
                >
                  {i + 1}
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div style={{
                    position: "absolute",
                    marginLeft: 11,
                    marginTop: 28,
                    width: 1,
                    height: 16,
                    background: "linear-gradient(180deg, rgba(45,212,191,0.2), transparent)",
                  }} />
                )}
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{step}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate("/network")}
            className="btn-primary w-full mt-5"
          >
            Open Network Intelligence Workspace
          </button>
        </div>
      </div>
    </div>
  );
}
