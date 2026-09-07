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
    <div className="flex flex-col h-full bg-[#020617] overflow-hidden">
      {/* ── Standardized Header Strip ── */}
      <div className="p-4 bg-slate-900/95 border-b border-slate-800/90 shadow-xl backdrop-blur-md shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge badge-info text-xs font-mono tracking-wider font-bold py-1 px-2.5 bg-slate-800 text-sky-300 border border-sky-500/30 text-glow-sky">
              STATE TACTICAL SURVEILLANCE & INVESTIGATION ALERTS
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 shadow-sm shadow-emerald-950/40 text-glow-emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE DATABASE SYNCHRONIZED
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400">
              PENDING: <strong className="text-amber-400 text-glow-amber">{unreadCount}</strong> / <strong className="text-slate-400">{alerts.length}</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-400 border border-slate-800 flex items-center justify-center shadow-md">
              <Bell size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase text-glow-white">
                  Investigative Notifications & Tactical Alerts
                </h1>
                {unreadCount > 0 && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold font-mono text-xs px-2.5 py-0.5 rounded-full text-glow-amber">
                    {unreadCount} PENDING
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-300 font-medium leading-relaxed">
                Action items requiring investigator review, syndicate flags, and anomaly notifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 bg-slate-950 text-xs md:text-sm font-mono font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              <Check size={14} className="text-slate-400" />
              <span>Acknowledge all</span>
            </button>
            <button
              onClick={loadAlerts}
              className="p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh alerts"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-sky-400" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Pills Bar */}
      <div className="px-4 py-3 border-b border-slate-800/90 bg-slate-900/90 flex items-center gap-2.5 shrink-0">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-1.5 rounded-lg text-xs md:text-sm font-mono transition-all cursor-pointer ${
            filter === "all"
              ? "bg-sky-950/80 border border-sky-500/60 text-sky-200 font-bold shadow-sm text-glow-sky"
              : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          All Alerts ({alerts.length})
        </button>

        <button
          onClick={() => setFilter("priority")}
          className={`px-4 py-1.5 rounded-lg text-xs md:text-sm font-mono transition-all cursor-pointer ${
            filter === "priority"
              ? "bg-sky-950/80 border border-sky-500/60 text-sky-200 font-bold shadow-sm text-glow-sky"
              : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          Priority Review (≥85%)
        </button>

        <button
          onClick={() => setFilter("network")}
          className={`px-4 py-1.5 rounded-lg text-xs md:text-sm font-mono transition-all cursor-pointer ${
            filter === "network"
              ? "bg-sky-950/80 border border-sky-500/60 text-sky-200 font-bold shadow-sm text-glow-sky"
              : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
          }`}
        >
          Network & Cross-District
        </button>
      </div>

      {/* Alerts List */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-3.5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-24 rounded-xl bg-slate-900/80 border border-slate-800" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400 bg-slate-900/95 border border-slate-800 rounded-xl shadow-xl">
              <ShieldCheck size={40} className="mx-auto mb-3 opacity-30 text-emerald-400" />
              <div className="text-base font-bold text-slate-200 uppercase tracking-wider">No active notifications</div>
              <p className="mt-1 text-xs text-slate-500">All tactical alerts have been reviewed by the investigating team.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => {
                const isAcknowledged = acknowledgedMap[item.id];
                const confPct = Math.round((item.confidence || 0.8) * 100);

                return (
                  <div
                    key={item.id}
                    className={`p-4.5 rounded-xl border transition-all ${
                      isAcknowledged
                        ? "bg-slate-950/60 border-slate-800/50 opacity-70"
                        : "bg-slate-900/95 border-slate-800/90 hover:border-sky-500/50 shadow-xl"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 shadow-md">
                          <AlertTriangle size={20} />
                        </div>

                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-bold text-white">
                              {item.what_happened}
                            </span>
                            <span className="badge badge-low text-xs font-mono font-bold">
                              {item.alert_type?.replace(/_/g, " ")}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              CONFIDENCE: <strong className="text-emerald-400 text-glow-emerald">{confPct}%</strong>
                            </span>
                          </div>

                          <p className="text-sm text-slate-200 leading-relaxed">
                            {item.why_it_matters}
                          </p>

                          {item.affected_entities && item.affected_entities.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-slate-400 pt-1 flex-wrap">
                              <Users size={14} className="text-slate-400" />
                              <span className="font-mono text-xs uppercase font-semibold">Linked Subjects:</span>
                              {item.affected_entities.map((e: any, idx: number) => {
                                const name = typeof e === "string" ? e : e.name || e.id;
                                return (
                                  <span
                                    key={idx}
                                    onClick={() => navigate(`/entities?q=${encodeURIComponent(name)}`)}
                                    className="px-2.5 py-0.5 rounded-md bg-slate-950 text-sky-400 font-mono text-xs hover:underline cursor-pointer border border-slate-800 text-glow-sky"
                                  >
                                    {name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                        <button
                          onClick={() => handleAcknowledge(item.id)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-mono font-semibold transition-colors cursor-pointer ${
                            isAcknowledged
                              ? "bg-slate-950 text-emerald-400 border border-emerald-500/40 text-glow-emerald"
                              : "bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300"
                          }`}
                        >
                          {isAcknowledged ? "Acknowledged ✓" : "Acknowledge"}
                        </button>

                        <button
                          onClick={() => navigate("/network")}
                          className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs md:text-sm font-mono flex items-center gap-1.5 shadow-md shadow-sky-500/20"
                          title="View in Network Graph"
                        >
                          <span>Analyze</span>
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
    </div>
  );
}
