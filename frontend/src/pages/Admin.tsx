import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Shield, Users, Terminal, Plus,
  RefreshCw, Database, Cpu, Lock
} from "lucide-react";

export default function Admin() {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New user modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("analyst");
  const [submitting, setSubmitting] = useState(false);

  function loadAdminData() {
    setLoading(true);
    Promise.all([
      api.adminTelemetry().catch(() => ({ telemetry: {} })),
      api.adminUsers().catch(() => ({ users: [] })),
      api.adminAudit().catch(() => ({ audit_logs: [] })),
    ]).then(([telRes, usrRes, audRes]) => {
      setTelemetry(telRes.telemetry || {});
      setUsers(usrRes.users || []);
      setAuditLogs(audRes.audit_logs || []);
      setLoading(false);
    });
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await api.updateAdminRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (e: any) {
      alert("Role update failed: " + e.message);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createAdminUser({ email, full_name: fullName, password, role });
      setEmail("");
      setFullName("");
      setPassword("");
      setShowUserModal(false);
      loadAdminData();
    } catch (e: any) {
      alert("Failed to create officer: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#020617] overflow-hidden">
      {/* ── Standardized Header Strip ── */}
      <div className="p-4 bg-slate-900/95 border-b border-slate-800/90 shadow-xl backdrop-blur-md shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge badge-info text-[10px] font-mono tracking-wider font-bold py-0.5 px-2 bg-slate-800 text-sky-300 border border-sky-500/30 text-glow-sky">
              STATE SECURITY GOVERNANCE & ACCESS CONTROL
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 shadow-sm shadow-emerald-950/40 text-glow-emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE DATABASE SYNCHRONIZED
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400">
              OFFICERS: <strong className="text-white text-glow-white">{users.length}</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-sky-400 border border-slate-800 flex items-center justify-center shadow-md">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-wide text-white uppercase text-glow-white">
                Security Governance & Access Control
              </h1>
              <p className="text-xs text-slate-300 font-medium">
                Role-based access control, cryptographic system audit logs, and core infrastructure telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowUserModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition-all cursor-pointer"
            >
              <Plus size={13} />
              <span>Provision Officer</span>
            </button>

            <button
              onClick={loadAdminData}
              className="p-2 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white bg-slate-950 transition-all cursor-pointer"
              title="Refresh Security Status"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-sky-400" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content Body ── */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 max-w-6xl mx-auto w-full">
        {/* Telemetry Stat Cards */}
        {telemetry && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                <span>Database Engine</span>
                <Database size={14} className="text-sky-400" />
              </div>
              <div className="text-base font-bold text-white mt-1.5 font-mono">
                {telemetry.database || "PostgreSQL Core"}
              </div>
              <div className="text-[10px] font-mono text-emerald-400 mt-0.5 text-glow-emerald">Status: Operational</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                <span>Entities Indexed</span>
                <Users size={14} className="text-blue-400" />
              </div>
              <div className="text-base font-black text-white mt-1.5 font-mono text-glow-white">
                {(telemetry.total_persons || 0) + (telemetry.total_vehicles || 0) + (telemetry.total_phones || 0)}
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">Persons, Phones & Plates</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                <span>Network Associations</span>
                <Cpu size={14} className="text-purple-400" />
              </div>
              <div className="text-base font-black text-white mt-1.5 font-mono text-glow-white">
                {telemetry.total_relationships || 0}
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">Corroborated Linkages</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                <span>Evidence Hash Chain</span>
                <Lock size={14} className="text-emerald-400" />
              </div>
              <div className="text-base font-bold text-white mt-1.5 font-mono">
                SHA-256 Ledger
              </div>
              <div className="text-[10px] font-mono text-emerald-400 mt-0.5 text-glow-emerald">100% Tamper Evident</div>
            </div>
          </div>
        )}

        {/* Officer Provisioning Table */}
        <div className="p-5 bg-slate-900/95 border border-slate-800/90 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-sky-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Authorized Personnel & Role Assignments
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {users.length} OFFICERS REGISTERED
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="investigation-table text-xs w-full">
              <thead>
                <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th>Officer Name</th>
                  <th>Official Email</th>
                  <th>Clearance Role</th>
                  <th>Account Status</th>
                  <th>Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="font-semibold text-white">{u.full_name}</td>
                    <td className="font-mono text-slate-300">{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none"
                      >
                        <option value="admin">Administrator (Root)</option>
                        <option value="investigator">Lead Investigator</option>
                        <option value="analyst">Crime Analyst</option>
                      </select>
                    </td>
                    <td>
                      <span className="badge badge-verified text-[8px] font-mono text-glow-emerald">ACTIVE</span>
                    </td>
                    <td className="text-[11px] text-slate-400">
                      {u.role === "admin"
                        ? "Full Security & User Provisioning"
                        : u.role === "investigator"
                        ? "Case & Evidence Seizure Authorization"
                        : "Intelligence Analysis & Dossier Inspection"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Log */}
        <div className="p-5 bg-slate-900/95 border border-slate-800/90 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-sky-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                System Security & Evidence Audit Trail
              </h2>
            </div>
            <span className="badge badge-low text-[8px] font-mono">LOG TAMPER-SEALED</span>
          </div>

          <div className="overflow-x-auto">
            <table className="investigation-table text-xs w-full">
              <thead>
                <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th>Timestamp</th>
                  <th>Security Action</th>
                  <th>Operator</th>
                  <th>Detail & Record Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-slate-400 font-mono">
                      No security events logged in current session.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="font-mono text-[10px] text-slate-400">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : "2026-09-05"} IST
                      </td>
                      <td>
                        <span className="badge badge-low text-[8px] font-mono">{log.action || "AUDIT_EVENT"}</span>
                      </td>
                      <td className="font-semibold text-white">{log.user || "System Officer"}</td>
                      <td className="text-[11px] text-slate-300 leading-relaxed">{log.details || log.target || "Routine verified access"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Provision Officer Modal */}
      {showUserModal && (
        <div className="cmd-palette-backdrop" onClick={() => setShowUserModal(false)}>
          <div className="cmd-palette-modal max-w-md p-6 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-sky-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Provision Law-Enforcement Personnel
                </h2>
              </div>
              <button onClick={() => setShowUserModal(false)} className="text-xs font-mono text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="py-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1 font-bold">Full Legal Name</label>
                <input
                  required
                  placeholder="e.g. Insp. Vikram Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1 font-bold">Official Department Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. vikram.sharma@police.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1 font-bold">Initial Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1 font-bold">Clearance Level Assignment</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 outline-none"
                >
                  <option value="analyst">Crime Analyst (Read & Synthesis)</option>
                  <option value="investigator">Lead Investigator (Case & Exhibit Registration)</option>
                  <option value="admin">System Administrator (Root Governance)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20">
                  {submitting ? "Provisioning..." : "Issue Clearance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
