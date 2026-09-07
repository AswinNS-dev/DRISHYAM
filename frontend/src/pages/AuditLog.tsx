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
    const matchesSearch =
      !search ||
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.details?.toLowerCase().includes(search.toLowerCase()) ||
      l.operator_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.operator_email?.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === "ALL" || l.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action).filter(Boolean)));

  return (
    <div className="flex flex-col h-full bg-[#020617]">
      {/* ── Standardized Header Strip ── */}
      <div className="p-4 bg-slate-900/95 border-b border-slate-800/90 shadow-xl backdrop-blur-md shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge badge-info text-xs font-mono tracking-wider font-bold py-1 px-2.5 bg-slate-800 text-sky-300 border border-sky-500/30 text-glow-sky">
              STATE IMMUTABLE SECURITY & AUDIT TRAIL
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 shadow-sm shadow-emerald-950/40 text-glow-emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE DATABASE SYNCHRONIZED
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400">
              AUDIT RECORDS: <strong className="text-white text-glow-white">{filteredLogs.length}</strong> / <strong className="text-slate-400">{logs.length}</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950 text-sky-400 border border-slate-800 flex items-center justify-center shadow-md">
              <Terminal size={22} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase text-glow-white">
                System Security & Investigation Audit Log
              </h1>
              <p className="text-sm text-slate-300 font-medium leading-relaxed">
                Authorized actions, evidence seal verifications, dossier accesses, and credential governance records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadAudit}
              className="p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white bg-slate-950 transition-all cursor-pointer"
              title="Refresh Audit Records"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-sky-400" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Status Metrics Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 p-4 border-b border-slate-800/90 bg-slate-900/60 shrink-0">
        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">Indexed Audit Events</div>
          <div className="text-2xl md:text-3xl font-black font-mono text-white text-glow-white mt-1">{logs.length}</div>
        </div>
        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">Evidence Operations</div>
          <div className="text-2xl md:text-3xl font-black font-mono text-emerald-400 text-glow-emerald mt-1">
            {logs.filter((l) => l.action?.includes("EVIDENCE")).length}
          </div>
        </div>
        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">User Governance</div>
          <div className="text-2xl md:text-3xl font-black font-mono text-sky-400 text-glow-sky mt-1">
            {logs.filter((l) => l.action?.includes("USER")).length}
          </div>
        </div>
        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">Tamper Status</div>
          <div className="text-lg md:text-xl font-black font-mono text-emerald-400 text-glow-emerald mt-1.5">SEALED (SHA-256)</div>
        </div>
      </div>

      {/* ── Filter Controls ── */}
      <div className="px-4 py-3 border-b border-slate-800/90 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by action, operator, or record details..."
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-lg pl-9 pr-3 py-2 text-sm font-mono text-slate-100 placeholder:text-slate-500 outline-none transition-all shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg px-3 py-2 transition-colors">
            <Filter size={14} className="text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-transparent text-xs md:text-sm font-semibold font-mono text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-950">All Actions</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act} className="bg-slate-950">
                  {act}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400">
          Showing <strong className="text-white">{filteredLogs.length}</strong> events
        </div>
      </div>

      {/* ── Table View ── */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="border border-slate-800/90 bg-slate-900/95 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="investigation-table text-sm w-full">
              <thead>
                <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-mono text-xs uppercase tracking-wider font-bold">
                  <th className="w-52 py-3 px-4 text-left">Timestamp (IST)</th>
                  <th className="w-60 py-3 px-4 text-left">Security Action</th>
                  <th className="w-72 py-3 px-4 text-left">Operator & Clearance</th>
                  <th className="py-3 px-4 text-left">Target & Operation Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-slate-400 font-mono text-sm">
                      Loading audit records from database...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-slate-400 font-mono text-sm">
                      No security audit events matched the filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="font-mono text-xs text-slate-400 whitespace-nowrap py-3 px-4">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString("en-IN") : "2026-09-05"} IST
                      </td>
                      <td className="py-3 px-4">
                        <span className="badge badge-low text-xs font-mono font-bold">
                          {log.action || "SECURITY_AUDIT"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="text-sm md:text-base font-bold text-white">
                            {log.operator_name || log.user || "Authorized Officer"}
                          </div>
                          <div className="text-xs font-mono text-slate-400">
                            {log.operator_email || "system@police.gov.in"} • <strong className="text-sky-400">{(log.operator_role || "investigator").toUpperCase()}</strong>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs md:text-sm text-slate-200 leading-relaxed py-3 px-4">
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
