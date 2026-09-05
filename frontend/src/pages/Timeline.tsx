import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  Clock, Filter, Search, RefreshCw, Users
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

  function getEventBadge(type: string) {
    switch (type) {
      case "FIR_FILED":
        return <span className="badge badge-low text-[8px]">FIR COMPLAINT</span>;
      case "TRANSACTION":
        return <span className="badge badge-demo text-[8px]">CAPITAL TRANSFER</span>;
      case "ANOMALY_FLAGGED":
        return <span className="badge badge-high text-[8px]">UNUSUAL ACTIVITY</span>;
      case "TACTICAL_ALERT":
        return <span className="badge badge-medium text-[8px]">SURVEILLANCE SIGHTING</span>;
      default:
        return <span className="badge badge-low text-[8px]">CHRONOLOGY</span>;
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-void)]">
      {/* ── Top Header Strip ── */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-panel-solid)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
            <Clock size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold tracking-wide uppercase text-[var(--text-primary)]">
                Investigative Chronology Reconstruction
              </h1>
              <span className="badge badge-low text-[8px]">TEMPORAL AUDIT</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Temporal event reconstruction before, during, and after registered crime incidents
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative w-60">
            <Search size={12} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search timeline events or suspects..."
              className="workstation-input pl-7 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded px-2 py-1">
            <Filter size={12} className="text-[var(--text-muted)]" />
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="bg-transparent text-xs text-[var(--text-secondary)] outline-none cursor-pointer"
            >
              <option value="" className="bg-[var(--bg-panel-solid)]">All Event Types</option>
              <option value="FIR_FILED" className="bg-[var(--bg-panel-solid)]">FIR Filings</option>
              <option value="TRANSACTION" className="bg-[var(--bg-panel-solid)]">Capital Transfers</option>
              <option value="ANOMALY_FLAGGED" className="bg-[var(--bg-panel-solid)]">Unusual Activities</option>
              <option value="TACTICAL_ALERT" className="bg-[var(--bg-panel-solid)]">Tactical Sightings</option>
            </select>
          </div>

          <button
            onClick={loadTimeline}
            className="p-1.5 rounded border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-panel-raised)] transition-all"
            title="Refresh Timeline"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[var(--intel-sky)]" : ""} />
          </button>
        </div>
      </div>

      {/* ── Main Timeline Spine & Event Cards ── */}
      <div className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton h-24 rounded-lg" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20 text-xs text-[var(--text-muted)]">
            No chronological records found matching active filter.
          </div>
        ) : (
          <div className="relative pl-6 border-l-2 border-[var(--border-strong)] space-y-6">
            {filteredEvents.map((evt, idx) => {
              const dateObj = evt.timestamp ? new Date(evt.timestamp) : new Date();
              const isFir = evt.event_type === "FIR_FILED";

              return (
                <div key={evt.id || idx} className="relative group">
                  {/* Dot on spine */}
                  <div
                    className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center bg-[var(--bg-void)] border-2 border-[var(--intel-blue)]"
                  />

                  {/* Event Card */}
                  <div className={`panel p-4 bg-[var(--bg-panel-solid)] border ${isFir ? "border-[var(--intel-sky)]" : "border-[var(--border-subtle)]"} hover:border-[var(--border-strong)] transition-all space-y-2`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2">
                        {getEventBadge(evt.event_type)}
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {evt.title}
                        </span>
                      </div>

                      <div className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1.5">
                        <Clock size={11} className="text-[var(--intel-sky)]" />
                        <span>{dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST</span>
                      </div>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {evt.description}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-muted)]">
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--text-muted)]">SOURCE RECORD:</span>
                        <span className="text-[var(--intel-sky)] font-semibold">{evt.source_doc || "Incident Record"}</span>
                      </div>

                      {evt.entity_tags?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Users size={11} className="text-[var(--text-muted)]" />
                          {evt.entity_tags.map((t: any) => (
                            <span
                              key={t.id}
                              onClick={() => navigate("/entities")}
                              className="px-1.5 py-0.5 rounded bg-[var(--bg-panel-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      )}
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
