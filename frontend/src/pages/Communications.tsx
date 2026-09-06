import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  PhoneCall, Search, Filter, RefreshCw, Radio,
  ArrowRight, ChevronRight
} from "lucide-react";

export default function Communications() {
  const navigate = useNavigate();
  const [communications, setCommunications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minFrequency, setMinFrequency] = useState<number>(1);
  const [stats, setStats] = useState({ total: 0, uniqueTransceivers: 0 });

  function loadCommunications() {
    setLoading(true);
    api.communications({ q: search || undefined })
      .then((res) => {
        setCommunications(res.communications || []);
        setStats({
          total: res.total_records || 0,
          uniqueTransceivers: res.unique_transceivers || 0,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadCommunications();
  }, [search]);

  const filtered = communications.filter(
    (c) => (c.frequency_count || 1) >= minFrequency
  );

  return (
    <div className="flex flex-col h-full bg-[var(--bg-void)]">
      {/* ── Top Header Strip ── */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-panel-solid)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
            <Radio size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold tracking-wide uppercase text-[var(--text-primary)]">
                Communications & Telephony Analysis
              </h1>
              <span className="badge badge-low text-[8px]">CDR INTELLIGENCE</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Call Detail Records (CDR), handset usage links, and transceiver frequency matrix
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadCommunications}
            className="p-1.5 rounded border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-panel-raised)] transition-all"
            title="Refresh CDR Feed"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[var(--intel-sky)]" : ""} />
          </button>
        </div>
      </div>

      {/* ── Summary Operational Metrics Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Active Intercepts</div>
          <div className="text-base font-bold font-mono text-[var(--text-bright)] mt-0.5">{stats.total}</div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Unique Transceivers</div>
          <div className="text-base font-bold font-mono text-[var(--intel-sky)] mt-0.5">{stats.uniqueTransceivers}</div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">High-Frequency Pairs</div>
          <div className="text-base font-bold font-mono text-[var(--status-purple)] mt-0.5">
            {communications.filter((c) => (c.frequency_count || 1) >= 8).length}
          </div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Data Ingestion Standard</div>
          <div className="text-xs font-mono text-[var(--status-verified)] mt-1">TRAI CDR Spec V2</div>
        </div>
      </div>

      {/* ── Filter Controls ── */}
      <div className="px-6 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search size={12} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by suspect name, MSISDN / phone number, or exhibit ID..."
              className="workstation-input pl-8 pr-3 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded px-2.5 py-1">
            <Filter size={12} className="text-[var(--text-muted)]" />
            <select
              value={minFrequency}
              onChange={(e) => setMinFrequency(Number(e.target.value))}
              className="bg-transparent text-xs text-[var(--text-secondary)] outline-none cursor-pointer"
            >
              <option value={1} className="bg-[var(--bg-panel-solid)]">All Interactions (1+)</option>
              <option value={4} className="bg-[var(--bg-panel-solid)]">Medium Traffic (4+ calls)</option>
              <option value={8} className="bg-[var(--bg-panel-solid)]">Burst / Syndicate (8+ calls)</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] font-mono text-[var(--text-muted)]">
          {filtered.length} Communication Traces Indexed
        </div>
      </div>

      {/* ── Main Data View ── */}
      <div className="flex-1 p-6 overflow-y-auto space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-20 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel p-12 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-panel-solid)]">
            <PhoneCall size={32} className="mx-auto mb-2 opacity-30" />
            <div className="font-semibold text-[var(--text-secondary)] uppercase">No communication records matched</div>
            <p className="mt-1 text-[11px]">Adjust search query or frequency filter.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => {
              const isBurst = (item.frequency_count || 1) >= 8;

              return (
                <div
                  key={item.id}
                  className={`panel p-3.5 bg-[var(--bg-panel-solid)] hover:border-[var(--border-strong)] transition-all ${
                    isBurst ? "border-l-2 border-l-[var(--status-warning)]" : ""
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Originating & Terminating Parties */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded flex items-center justify-center bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-[var(--intel-sky)] shrink-0">
                        <PhoneCall size={15} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-w-0">
                        {/* Caller */}
                        <div className="space-y-0.5">
                          <div className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
                            Originating Party
                          </div>
                          <div
                            onClick={() => navigate(`/entities?q=${encodeURIComponent(item.caller_name)}`)}
                            className="text-xs font-bold text-[var(--text-primary)] hover:text-[var(--intel-sky)] cursor-pointer truncate"
                          >
                            {item.caller_name}
                          </div>
                          <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                            {item.caller_phone}
                          </div>
                        </div>

                        {/* Arrow & Receiver */}
                        <div className="space-y-0.5">
                          <div className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
                            <ArrowRight size={10} />
                            <span>Terminating Party</span>
                          </div>
                          <div
                            onClick={() => navigate(`/entities?q=${encodeURIComponent(item.receiver_name)}`)}
                            className="text-xs font-bold text-[var(--text-primary)] hover:text-[var(--intel-sky)] cursor-pointer truncate"
                          >
                            {item.receiver_name}
                          </div>
                          <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                            {item.receiver_phone}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Metrics & Timing */}
                    <div className="flex items-center gap-4 text-xs shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--border-subtle)]">
                      <div className="text-right">
                        <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Interactions</div>
                        <div className="font-mono font-bold text-[var(--text-bright)]">
                          {item.frequency_count} calls
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Avg Duration</div>
                        <div className="font-mono text-[var(--text-secondary)]">
                          {Math.floor(item.duration_seconds / 60)}m {item.duration_seconds % 60}s
                        </div>
                      </div>

                      <div className="text-right min-w-[130px]">
                        <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Last Contact</div>
                        <div className="font-mono text-[11px] text-[var(--text-secondary)]">
                          {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    {/* Right: Evidence Reference */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="badge badge-low text-[9px] font-mono">
                        {item.source_evidence}
                      </span>
                      <button
                        onClick={() => navigate(`/network`)}
                        className="p-1 rounded bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-[var(--intel-sky)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        title="View in Network Graph"
                      >
                        <ChevronRight size={13} />
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
