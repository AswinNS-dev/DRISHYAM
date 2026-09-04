import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Bell } from "lucide-react";

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => { api.alerts().then((r) => setAlerts(r.alerts)); }, []);

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={18} color="var(--accent-teal)" />
        <h1 className="text-lg font-semibold">Intelligence Alerts</h1>
      </div>
      <div className="space-y-3">
        {alerts.map((a) => (
          <div key={a.id} className="panel p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="badge badge-medium">{a.alert_type.replaceAll("_", " ")}</span>
              <span className="text-[10px] text-[var(--text-muted)]">{new Date(a.created_at).toLocaleString()}</span>
            </div>
            <div className="text-sm font-medium mb-1">{a.what_happened}</div>
            <div className="text-xs text-[var(--text-secondary)] mb-3">{a.why_it_matters}</div>
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {a.affected_entities.map((e: any) => (
                  <span key={e.id} className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-panel-raised)] text-[var(--text-secondary)]">{e.name}</span>
                ))}
              </div>
              <div className="w-20">
                <div className="confidence-bar"><div className="confidence-fill" style={{ width: `${a.confidence * 100}%` }} /></div>
                <div className="text-[9px] text-[var(--text-muted)] text-right mt-0.5">{Math.round(a.confidence * 100)}% confidence</div>
              </div>
            </div>
          </div>
        ))}
        {alerts.length === 0 && <div className="text-sm text-[var(--text-muted)]">No alerts yet.</div>}
      </div>
    </div>
  );
}
