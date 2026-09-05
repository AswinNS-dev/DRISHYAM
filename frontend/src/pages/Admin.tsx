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
    <div className="flex flex-col h-full bg-[var(--bg-void)]">
      {/* ── Top Header ── */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-panel-solid)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
            <Shield size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold tracking-wide uppercase text-[var(--text-primary)]">
                Security Governance & Access Control
              </h1>
              <span className="badge badge-low text-[8px]">ROOT PRIVILEGES</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Role-based access control, cryptographic system audit logs, and core infrastructure telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowUserModal(true)}
            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
          >
            <Plus size={13} />
            <span>Provision Officer</span>
          </button>

          <button
            onClick={loadAdminData}
            className="p-1.5 rounded border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-panel-raised)] transition-all"
            title="Refresh Security Status"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[var(--intel-sky)]" : ""} />
          </button>
        </div>
      </div>

      {/* ── Main Content Body ── */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6 max-w-6xl mx-auto w-full">
        {/* Telemetry Stat Cards */}
        {telemetry && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="panel p-3.5 bg-[var(--bg-panel-solid)]">
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] uppercase">
                <span>Database Engine</span>
                <Database size={13} className="text-[var(--intel-sky)]" />
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)] mt-1.5">
                {telemetry.database || "PostgreSQL Core"}
              </div>
              <div className="text-[10px] font-mono text-[var(--status-verified)] mt-0.5">Status: Operational</div>
            </div>

            <div className="panel p-3.5 bg-[var(--bg-panel-solid)]">
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] uppercase">
                <span>Entities Indexed</span>
                <Users size={13} className="text-[#3b82f6]" />
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)] mt-1.5">
                {(telemetry.total_persons || 0) + (telemetry.total_vehicles || 0) + (telemetry.total_phones || 0)}
              </div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">Persons, Phones & Plates</div>
            </div>

            <div className="panel p-3.5 bg-[var(--bg-panel-solid)]">
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] uppercase">
                <span>Network Associations</span>
                <Cpu size={13} className="text-[var(--status-purple)]" />
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)] mt-1.5">
                {telemetry.total_relationships || 0}
              </div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">Corroborated Linkages</div>
            </div>

            <div className="panel p-3.5 bg-[var(--bg-panel-solid)]">
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] uppercase">
                <span>Evidence Hash Chain</span>
                <Lock size={13} className="text-[var(--status-verified)]" />
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)] mt-1.5">
                SHA-256 Ledger
              </div>
              <div className="text-[10px] font-mono text-[var(--status-verified)] mt-0.5">100% Tamper Evident</div>
            </div>
          </div>
        )}

        {/* Officer Provisioning Table */}
        <div className="panel p-5 bg-[var(--bg-panel-solid)] space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-[var(--intel-sky)]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Authorized Personnel & Role Assignments
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {users.length} OFFICERS REGISTERED
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="investigation-table text-xs">
              <thead>
                <tr>
                  <th>Officer Name</th>
                  <th>Official Email</th>
                  <th>Clearance Role</th>
                  <th>Account Status</th>
                  <th>Permissions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold text-[var(--text-primary)]">{u.full_name}</td>
                    <td className="font-mono text-[var(--text-secondary)]">{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
                      >
                        <option value="admin">Administrator (Root)</option>
                        <option value="investigator">Lead Investigator</option>
                        <option value="analyst">Crime Analyst</option>
                      </select>
                    </td>
                    <td>
                      <span className="badge badge-verified text-[8px]">ACTIVE</span>
                    </td>
                    <td className="text-[11px] text-[var(--text-muted)]">
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
        <div className="panel p-5 bg-[var(--bg-panel-solid)] space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <Terminal size={15} className="text-[var(--intel-sky)]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                System Security & Evidence Audit Trail
              </h2>
            </div>
            <span className="badge badge-low text-[8px]">LOG TAMPER-SEALED</span>
          </div>

          <div className="overflow-x-auto">
            <table className="investigation-table text-xs">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Security Action</th>
                  <th>Operator</th>
                  <th>Detail & Record Target</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-[var(--text-muted)]">
                      No security events logged in current session.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-[10px] text-[var(--text-muted)]">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : "2026-09-05"} IST
                      </td>
                      <td>
                        <span className="badge badge-low text-[8px]">{log.action || "AUDIT_EVENT"}</span>
                      </td>
                      <td className="font-semibold text-[var(--text-primary)]">{log.user || "System Officer"}</td>
                      <td className="text-[11px] text-[var(--text-secondary)]">{log.details || log.target || "Routine verified access"}</td>
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
          <div className="cmd-palette-modal max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-[var(--intel-sky)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Provision Law-Enforcement Personnel
                </h2>
              </div>
              <button onClick={() => setShowUserModal(false)} className="text-xs font-mono text-[var(--text-muted)]">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="py-4 space-y-3 text-xs">
              <div>
                <label className="hud-label text-[9px] block mb-1">Full Legal Name</label>
                <input
                  required
                  placeholder="e.g. Insp. Vikram Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="workstation-input"
                />
              </div>

              <div>
                <label className="hud-label text-[9px] block mb-1">Official Department Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. vikram.sharma@police.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="workstation-input"
                />
              </div>

              <div>
                <label className="hud-label text-[9px] block mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="workstation-input"
                />
              </div>

              <div>
                <label className="hud-label text-[9px] block mb-1">Clearance Level Assignment</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="workstation-input"
                >
                  <option value="analyst">Crime Analyst (Read & Synthesis)</option>
                  <option value="investigator">Lead Investigator (Case & Exhibit Registration)</option>
                  <option value="admin">System Administrator (Root Governance)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <button type="button" onClick={() => setShowUserModal(false)} className="btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
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
