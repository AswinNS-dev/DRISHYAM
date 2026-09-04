import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Bell, AlertTriangle } from "lucide-react";

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.alerts()
      .then((r) => setAlerts(r.alerts))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl page-enter">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center" style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(45,212,191,0.1)",
          boxShadow: "0 0 16px rgba(0,255,255,0.08)",
        }}>
          <Bell size={18} color="var(--neon-teal)" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Intelligence Alerts</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            System-generated alerts from anomaly detection and network analysis
          </p>
        </div>
        <span className="badge badge-info ml-auto" style={{ fontSize: 10 }}>
          {alerts.length} alerts
        </span>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 100 }} />
          ))}
        </div>
      )}

      <div className="space-y-3 stagger-in">
        {alerts.map((a) => {
          const severityClass = a.confidence > 0.85 ? "neon-border-left-red"
            : a.confidence > 0.6 ? "neon-border-left-amber" : "neon-border-left";
          return (
            <div key={a.id} className={`glass-panel p-4 hover-lift ${severityClass}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} color={
                    a.confidence > 0.85 ? "var(--neon-red)" : a.confidence > 0.6 ? "var(--neon-amber)" : "var(--neon-teal)"
                  } />
                  <span className="badge badge-medium">{a.alert_type.replaceAll("_", " ")}</span>
                </div>
                <span className="hud-label" style={{ fontSize: 9 }}>
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </div>

              <div className="text-sm font-medium mb-1">{a.what_happened}</div>
              <div className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                {a.why_it_matters}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {a.affected_entities.map((e: any) => (
                    <span key={e.id} className="badge badge-info" style={{ fontSize: 9, padding: "2px 8px" }}>
                      {e.name}
                    </span>
                  ))}
                </div>

                {/* Confidence ring */}
                <div className="flex items-center gap-2">
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: "50%",
                    background: `conic-gradient(${
                      a.confidence > 0.85 ? "var(--neon-red)" : a.confidence > 0.6 ? "var(--neon-amber)" : "var(--neon-teal)"
                    } ${a.confidence * 360}deg, rgba(45,212,191,0.08) 0deg)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <div style={{
                      width: 28, height: 28,
                      borderRadius: "50%",
                      background: "var(--bg-panel-solid)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text-secondary)",
                    }}>
                      {Math.round(a.confidence * 100)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!loading && alerts.length === 0 && (
          <div className="glass-panel p-8 text-center">
            <Bell size={32} color="var(--text-muted)" className="mx-auto mb-3" style={{ opacity: 0.3 }} />
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>No alerts generated yet.</div>
          </div>
        )}
      </div>
    </div>
  );
}
