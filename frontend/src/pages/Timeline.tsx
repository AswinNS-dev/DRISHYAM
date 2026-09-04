import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  Clock, Filter, Search, Calendar, FileText, AlertTriangle,
  Zap, DollarSign, RefreshCw
} from "lucide-react";

export default function Timeline() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  function loadTimeline() {
    setLoading(true);
    api.timeline({ event_type: eventTypeFilter || undefined })
      .then((res) => {
        setEvents(res.timeline || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadTimeline();
  }, [eventTypeFilter]);

  const filteredEvents = events.filter((e) =>
    !search ||
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.entity_tags?.some((t: any) => t.name.toLowerCase().includes(search.toLowerCase()))
  );

  function getEventIcon(type: string) {
    switch (type) {
      case "FIR_FILED":
        return <FileText size={14} className="text-[var(--neon-teal)]" />;
      case "TRANSACTION":
        return <DollarSign size={14} className="text-[var(--neon-amber)]" />;
      case "ANOMALY_FLAGGED":
        return <AlertTriangle size={14} className="text-[var(--accent-red)]" />;
      case "TACTICAL_ALERT":
        return <Zap size={14} className="text-[var(--neon-cyan)]" />;
      default:
        return <Clock size={14} className="text-[var(--text-muted)]" />;
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-void)]">
      {/* ── Top HUD Header ── */}
      <div
        className="px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 glass-panel"
        style={{ borderColor: "var(--border-subtle)", borderRadius: 0 }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(45,212,191,0.2), rgba(0,255,255,0.05))",
              border: "1px solid rgba(45,212,191,0.3)",
              boxShadow: "0 0 12px rgba(45,212,191,0.2)",
            }}
          >
            <Clock size={18} color="var(--neon-teal)" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wide uppercase text-[var(--text-primary)]">
                Chronological Intelligence Timeline
              </h1>
              <span className="hud-label text-[9px] text-[var(--neon-teal)]">AUDIT STREAM</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Temporal event reconstruction across complaints, capital flows, and syndicate movements
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-64">
            <Search size={13} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search timeline events..."
              className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)]"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1">
            <Filter size={12} className="text-[var(--text-muted)]" />
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="bg-transparent text-xs text-[var(--text-secondary)] outline-none cursor-pointer"
            >
              <option value="" className="bg-[var(--bg-panel)]">All Incident Types</option>
              <option value="FIR_FILED" className="bg-[var(--bg-panel)]">FIR Filings</option>
              <option value="TRANSACTION" className="bg-[var(--bg-panel)]">Capital Transfers</option>
              <option value="ANOMALY_FLAGGED" className="bg-[var(--bg-panel)]">Anomalies</option>
              <option value="TACTICAL_ALERT" className="bg-[var(--bg-panel)]">Tactical Alerts</option>
            </select>
          </div>

          <button
            onClick={loadTimeline}
            className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--neon-teal)] text-[var(--text-muted)] hover:text-[var(--neon-teal)] transition-all bg-[var(--bg-panel-raised)]"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[var(--neon-teal)]" : ""} />
          </button>
        </div>
      </div>

      {/* ── Main Timeline View ── */}
      <div className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full">
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="glass-panel p-4 h-24 rounded-xl animate-pulse border border-[var(--border-subtle)]" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20 text-xs text-[var(--text-muted)]">
            No chronological records found matching active filter.
          </div>
        ) : (
          <div className="relative pl-6 border-l-2 border-[rgba(45,212,191,0.25)] space-y-6">
            {filteredEvents.map((evt, idx) => (
              <div key={evt.id || idx} className="relative group">
                {/* Glowing Node on Spine */}
                <div
                  className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full flex items-center justify-center transition-transform group-hover:scale-125"
                  style={{
                    backgroundColor: "var(--bg-void)",
                    border: "2px solid var(--neon-teal)",
                    boxShadow: "0 0 10px rgba(45,212,191,0.5)",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-teal)]" />
                </div>

                {/* Event Card */}
                <div className="glass-panel p-4 rounded-xl border border-[var(--border-subtle)] group-hover:border-[rgba(45,212,191,0.4)] transition-all relative">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)]">
                        {getEventIcon(evt.event_type)}
                      </div>
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {evt.title}
                      </span>
                      <span
                        className={`badge text-[9px] ${
                          evt.severity === "critical"
                            ? "badge-critical"
                            : evt.severity === "high"
                            ? "badge-high"
                            : "badge-medium"
                        }`}
                      >
                        {evt.severity?.toUpperCase()}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
                    {evt.description}
                  </p>

                  {/* Entity Tags */}
                  {evt.entity_tags && evt.entity_tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[var(--border-subtle)] text-[10px]">
                      <span className="text-[var(--text-muted)] uppercase font-mono">Associated:</span>
                      {evt.entity_tags.map((tag: any, i: number) => (
                        <span
                          key={i}
                          onClick={() => navigate("/entities")}
                          className="px-2 py-0.5 rounded bg-[rgba(45,212,191,0.1)] text-[var(--neon-teal)] border border-[rgba(45,212,191,0.25)] hover:border-[var(--neon-teal)] cursor-pointer transition-all"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
