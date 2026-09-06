import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  Bell, Check, AlertTriangle, ShieldCheck,
  RefreshCw, Users, ChevronRight
} from "lucide-react";

export default function Alerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "priority" | "network">("all");
  const [acknowledgedMap, setAcknowledgedMap] = useState<Record<string, boolean>>({});

  function loadAlerts() {
    setLoading(true);
    api.alerts()
      .then((r) => {
        setAlerts(r.alerts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  function handleAcknowledge(id: string) {
    setAcknowledgedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleMarkAllRead() {
    const allAck: Record<string, boolean> = {};
    alerts.forEach((a) => {
      allAck[a.id] = true;
    });
    setAcknowledgedMap(allAck);
  }

  const filtered = alerts.filter((a) => {
    if (filter === "priority") return (a.confidence || 0.8) >= 0.85;
    if (filter === "network") return a.alert_type?.includes("BRIDGE") || a.alert_type?.includes("DISTRICT");
    return true;
  });

  const unreadCount = alerts.filter((a) => !acknowledgedMap[a.id]).length;

  return (
    <div className="w-full max-w-5xl mx-auto page-enter py-4">
      <div className="bg-[#0c0c0e] border border-zinc-800/80 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6">
        {/* Header Strip */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
              <Bell size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold uppercase tracking-wider text-white">
                  Investigative Notifications & Tactical Alerts
                </h1>
                {unreadCount > 0 && (
                  <span className="bg-amber-500 text-black font-bold text-[10px] px-2 py-0.5 rounded-full leading-none">
                    {unreadCount} PENDING
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                Action items requiring investigator review, syndicate flags, and anomaly notifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-xs text-zinc-300 transition-colors cursor-pointer"
            >
              <Check size={13} className="text-zinc-400" />
              <span>Acknowledge all</span>
            </button>
            <button
              onClick={loadAlerts}
              className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh alerts"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-[var(--intel-sky)]" : ""} />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              filter === "all"
                ? "border border-zinc-700 bg-zinc-800/60 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            All Alerts ({alerts.length})
          </button>

          <button
            onClick={() => setFilter("priority")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              filter === "priority"
                ? "border border-zinc-700 bg-zinc-800/60 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Priority Review (≥85%)
          </button>

          <button
            onClick={() => setFilter("network")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              filter === "network"
                ? "border border-zinc-700 bg-zinc-800/60 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Network & Cross-District
          </button>
        </div>

        {/* Alerts List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500">
            <ShieldCheck size={32} className="mx-auto mb-2 opacity-30 text-emerald-400" />
            <div className="font-semibold text-zinc-400 uppercase">No active notifications</div>
            <p className="mt-1 text-[11px]">All tactical alerts have been reviewed by the investigating team.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const isAcknowledged = acknowledgedMap[item.id];
              const confPct = Math.round((item.confidence || 0.8) * 100);

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isAcknowledged
                      ? "bg-zinc-950/50 border-zinc-800/50 opacity-70"
                      : "bg-[#111114] border-zinc-800 hover:border-zinc-700 shadow-md"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                        <AlertTriangle size={15} />
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">
                            {item.what_happened}
                          </span>
                          <span className="badge badge-low text-[8px] font-mono">
                            {item.alert_type?.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            CONFIDENCE: {confPct}%
                          </span>
                        </div>

                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {item.why_it_matters}
                        </p>

                        {item.affected_entities && item.affected_entities.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 pt-1 flex-wrap">
                            <Users size={12} className="text-zinc-400" />
                            <span>Linked Subjects:</span>
                            {item.affected_entities.map((e: any, idx: number) => {
                              const name = typeof e === "string" ? e : e.name || e.id;
                              return (
                                <span
                                  key={idx}
                                  onClick={() => navigate(`/entities?q=${encodeURIComponent(name)}`)}
                                  className="px-1.5 py-0.5 rounded bg-zinc-900 text-sky-400 font-mono text-[10px] hover:underline cursor-pointer border border-zinc-800"
                                >
                                  {name}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                      <button
                        onClick={() => handleAcknowledge(item.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          isAcknowledged
                            ? "bg-zinc-900 text-emerald-400 border border-emerald-500/30"
                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                        }`}
                      >
                        {isAcknowledged ? "Acknowledged ✓" : "Acknowledge"}
                      </button>

                      <button
                        onClick={() => navigate("/network")}
                        className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1"
                        title="View in Network Graph"
                      >
                        <span>Analyze</span>
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
