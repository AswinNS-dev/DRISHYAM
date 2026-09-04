import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { AlertTriangle, GitBranch, Link2, Shield, Users, Network as NetworkIcon } from "lucide-react";

const CARDS = [
  { key: "active_investigations", label: "Active Investigations", icon: Shield, color: "var(--accent-blue)" },
  { key: "connected_entities", label: "Connected Entities", icon: Users, color: "var(--accent-teal)" },
  { key: "discovered_relationships", label: "Discovered Relationships", icon: Link2, color: "var(--accent-purple)" },
  { key: "unresolved_entity_matches", label: "Unresolved Entity Matches", icon: GitBranch, color: "var(--accent-amber)" },
  { key: "high_confidence_leads", label: "High-Confidence Leads", icon: NetworkIcon, color: "var(--accent-teal)" },
  { key: "anomalies", label: "Anomalies", icon: AlertTriangle, color: "var(--accent-red)" },
  { key: "cross_case_links", label: "Cross-Case Links", icon: Link2, color: "var(--accent-blue)" },
  { key: "network_communities", label: "Network Communities", icon: NetworkIcon, color: "var(--accent-purple)" },
];

export default function Dashboard() {
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.dashboardSummary().then(setSummary).catch(() => {});
    api.alerts().then((r) => setAlerts(r.alerts.slice(0, 5))).catch(() => {});
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Network Intelligence Overview</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Fragmented records transformed into an evidence-backed criminal network.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {CARDS.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="panel p-4">
            <div className="flex items-center justify-between mb-2">
              <Icon size={16} color={color} />
            </div>
            <div className="text-2xl font-bold">{summary ? summary[key] ?? "-" : "..."}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Recent Intelligence Alerts</h2>
            <button onClick={() => navigate("/alerts")} className="text-xs text-[var(--accent-teal)]">View all</button>
          </div>
          <div className="space-y-3">
            {alerts.map((a) => (
              <div key={a.id} className="border-b border-[var(--border-subtle)] pb-3 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--accent-amber)]">{a.alert_type.replaceAll("_", " ")}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{Math.round(a.confidence * 100)}% confidence</span>
                </div>
                <div className="text-sm mt-1">{a.what_happened}</div>
              </div>
            ))}
            {alerts.length === 0 && <div className="text-xs text-[var(--text-muted)]">No alerts yet.</div>}
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-sm font-semibold mb-3">Investigation Pipeline</h2>
          <div className="space-y-2 text-xs text-[var(--text-secondary)]">
            {[
              "Multi-source ingestion (FIR / CDR / financial / surveillance)",
              "NLP entity extraction",
              "Entity resolution & deduplication",
              "Relationship extraction with provenance",
              "Evidence-backed graph construction",
              "Centrality, community & hidden-link discovery",
              "Anomaly detection",
              "Dossier 360 & evidence-grounded AI leads",
            ].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] mono"
                     style={{ background: "var(--bg-panel-raised)", border: "1px solid var(--border-strong)" }}>
                  {i + 1}
                </div>
                {step}
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate("/network")}
            className="mt-4 w-full py-2 rounded-lg text-xs font-semibold bg-[var(--accent-teal)] text-[#08211d]"
          >
            Open Network Intelligence Workspace
          </button>
        </div>
      </div>
    </div>
  );
}
