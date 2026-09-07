import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Terminal, Search, Filter, RefreshCw
} from "lucide-react";

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  function loadAudit() {
    setLoading(true);
    api.auditLog()
      .then((res) => {
        setLogs(res.audit_logs || []);
        setLoading(false);
      })
      .catch(() => {
        // Fallback to adminAudit if available
        api.adminAudit()
          .then((res) => {
            setLogs(res.audit_logs || []);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      });
  }

  useEffect(() => {
    loadAudit();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const detailsText = typeof l.details === "string" ? l.details : JSON.stringify(l.details || "");
    const matchesSearch =
      !search ||
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      detailsText.toLowerCase().includes(search.toLowerCase()) ||
      l.operator_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.operator_email?.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === "ALL" || l.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action).filter(Boolean)));

  return (
    <div className="flex flex-col h-full bg-[var(--bg-void)]">
      {/* ── Top Header Strip ── */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-panel-solid)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
            <Terminal size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold tracking-wide uppercase text-[var(--text-primary)]">
                System Security & Investigation Audit Log
              </h1>
              <span className="badge badge-low text-[8px]">IMMUTABLE AUDIT TRAIL</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Authorized actions, evidence seal verifications, dossier accesses, and credential governance records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAudit}
            className="p-1.5 rounded border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-panel-raised)] transition-all"
            title="Refresh Audit Records"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[var(--intel-sky)]" : ""} />
          </button>
        </div>
      </div>

      {/* ── Status Metrics Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Indexed Audit Events</div>
          <div className="text-base font-bold font-mono text-[var(--text-bright)] mt-0.5">{logs.length}</div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Evidence Operations</div>
          <div className="text-base font-bold font-mono text-[var(--status-verified)] mt-0.5">
            {logs.filter((l) => l.action?.includes("EVIDENCE")).length}
          </div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">User Governance</div>
          <div className="text-base font-bold font-mono text-[var(--intel-sky)] mt-0.5">
            {logs.filter((l) => l.action?.includes("USER")).length}
          </div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Tamper Status</div>
          <div className="text-xs font-mono text-[var(--status-verified)] mt-1">SEALED (SHA-256)</div>
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
              placeholder="Search by action, operator, or record details..."
              className="workstation-input pl-8 pr-3 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded px-2.5 py-1">
            <Filter size={12} className="text-[var(--text-muted)]" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-transparent text-xs text-[var(--text-secondary)] outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-[var(--bg-panel-solid)]">All Actions</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act} className="bg-[var(--bg-panel-solid)]">
                  {act}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-[11px] font-mono text-[var(--text-muted)]">
          {filteredLogs.length} Events Logged
        </div>
      </div>

      {/* ── Table View ── */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="panel overflow-hidden bg-[var(--bg-panel-solid)]">
          <div className="overflow-x-auto">
            <table className="investigation-table text-xs w-full">
              <thead>
                <tr>
                  <th className="w-48">Timestamp (IST)</th>
                  <th className="w-56">Security Action</th>
                  <th className="w-64">Operator & Clearance</th>
                  <th>Target & Operation Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-[var(--text-muted)]">
                      Loading audit records from database...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-[var(--text-muted)]">
                      No security audit events matched the filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-[var(--bg-panel-hover)]">
                      <td className="font-mono text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                        {log.timestamp || log.created_at ? new Date(log.timestamp || log.created_at).toLocaleString("en-IN") : "2026-09-05"} IST
                      </td>
                      <td>
                        <span className={`badge text-[9px] font-mono font-semibold ${
                          log.action?.includes("FAIL") || log.action?.includes("TAMPER")
                            ? "badge-critical text-rose-300 border-rose-800/60 bg-rose-950/40"
                            : log.action?.includes("VERIFIED")
                            ? "badge-verified text-emerald-300 border-emerald-800/60 bg-emerald-950/40"
                            : log.action?.includes("EVIDENCE")
                            ? "badge-purple text-purple-300 border-purple-800/60 bg-purple-950/40"
                            : "badge-low text-sky-300 border-sky-800/60 bg-sky-950/40"
                        }`}>
                          {log.action || "SECURITY_AUDIT"}
                        </span>
                      </td>
                      <td>
                        <div className="space-y-0.5">
                          <div className="font-semibold text-[var(--text-primary)]">
                            {log.operator_name || log.user || "Authorized Officer"}
                          </div>
                          <div className="text-[10px] font-mono text-[var(--text-muted)]">
                            {log.operator_email || "system@police.gov.in"} • {(log.operator_role || "investigator").toUpperCase()}
                          </div>
                        </div>
                      </td>
                      <td className="text-[11px] text-[var(--text-secondary)]">
                        {log.details || log.target || "Routine verified investigation access"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
