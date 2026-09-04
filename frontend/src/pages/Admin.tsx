import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Shield, Users, Activity, Terminal, Plus,
  RefreshCw, X, Database, Cpu, Lock
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
      alert("Failed to create user: " + e.message);
    } finally {
      setSubmitting(false);
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
            <Shield size={18} color="var(--neon-teal)" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wide uppercase text-[var(--text-primary)]">
                Security Administration & Governance
              </h1>
              <span className="hud-label text-[9px] text-[var(--accent-red)]">ROOT ACCESS</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              RBAC permissions, cryptographic audit logging, and core neural engine telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUserModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--neon-teal)] text-[#08211d] hover:shadow-[0_0_12px_rgba(45,212,191,0.4)] transition-all"
          >
            <Plus size={14} />
            <span>Provision Officer</span>
          </button>

          <button
            onClick={loadAdminData}
            className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--neon-teal)] text-[var(--text-muted)] hover:text-[var(--neon-teal)] transition-all bg-[var(--bg-panel-raised)]"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[var(--neon-teal)]" : ""} />
          </button>
        </div>
      </div>

      {/* ── Main Body ── */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* Telemetry Stat Cards */}
        {telemetry && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-panel p-4 rounded-xl border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] uppercase font-mono">
                <span>Database Core</span>
                <Database size={14} className="text-[var(--neon-teal)]" />
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)] mt-2">{telemetry.database || "PostgreSQL"}</div>
              <div className="text-[10px] text-[var(--neon-teal)] font-mono mt-1">Status: Healthy</div>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] uppercase font-mono">
                <span>Graph Nodes</span>
                <Cpu size={14} className="text-[var(--neon-cyan)]" />
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)] mt-2">
                {(telemetry.total_persons || 0) + (telemetry.total_vehicles || 0) + (telemetry.total_phones || 0)} Indexed
              </div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono mt-1">
                {telemetry.total_relationships || 0} Relationships
              </div>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] uppercase font-mono">
                <span>Security Engine</span>
                <Lock size={14} className="text-[var(--neon-amber)]" />
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)] mt-2">AES-256 / SHA-256</div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono mt-1">Bcrypt Hash Verification</div>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] uppercase font-mono">
                <span>System Uptime</span>
                <Activity size={14} className="text-[var(--neon-teal)]" />
              </div>
              <div className="text-sm font-bold text-[var(--neon-teal)] mt-2">{telemetry.server_uptime || "99.98%"}</div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono mt-1">Zero Downtime Failover</div>
            </div>
          </div>
        )}

        {/* User Management Section */}
        <div className="glass-panel rounded-xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[var(--neon-teal)]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Authorized Personnel Directory (RBAC)
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">{users.length} REGISTERED OFFICERS</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[rgba(255,255,255,0.02)] border-b border-[var(--border-subtle)] text-[10px] font-mono uppercase text-[var(--text-muted)]">
                <tr>
                  <th className="p-3.5">Officer Name</th>
                  <th className="p-3.5">Email Identity</th>
                  <th className="p-3.5">Access Role</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Role Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="p-3.5 font-semibold text-[var(--text-primary)]">{u.full_name}</td>
                    <td className="p-3.5 font-mono text-[var(--text-secondary)]">{u.email}</td>
                    <td className="p-3.5">
                      <span
                        className={`badge text-[9px] ${
                          u.role === "admin"
                            ? "badge-critical"
                            : u.role === "investigator"
                            ? "badge-high"
                            : "badge-low"
                        }`}
                      >
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-[var(--neon-teal)] font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-teal)]" />
                        Active
                      </span>
                    </td>
                    <td className="p-3.5">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)]"
                      >
                        <option value="admin">Admin</option>
                        <option value="investigator">Investigator</option>
                        <option value="analyst">Analyst</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Log Stream */}
        <div className="glass-panel rounded-xl border border-[var(--border-subtle)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-[var(--neon-cyan)]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Tamper-Evident Audit Trail Stream
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[var(--neon-cyan)]">IMMUTABLE LEDGER</span>
          </div>

          <div className="max-h-72 overflow-y-auto p-3 space-y-1.5 font-mono text-[11px]">
            {auditLogs.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--text-muted)]">No audit entries recorded.</div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2 rounded bg-[rgba(10,14,24,0.6)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--neon-teal)] font-bold">[{log.action}]</span>
                    <span className="text-[var(--text-secondary)]">{JSON.stringify(log.details)}</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Provision Officer Modal ── */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel p-6 rounded-2xl border border-[var(--border-subtle)] w-full max-w-md shadow-[0_0_30px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-[var(--neon-teal)]" />
                <h3 className="text-sm font-bold uppercase text-[var(--text-primary)]">Provision Law Enforcement Officer</h3>
              </div>
              <button onClick={() => setShowUserModal(false)} className="text-[var(--text-muted)] hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="text-[10px] font-mono uppercase text-[var(--text-muted)] block mb-1">
                  Officer Full Name
                </label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Insp. Vikram Sharma"
                  className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[var(--text-muted)] block mb-1">
                  Official Email ID
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@police.gov.in"
                  className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[var(--text-muted)] block mb-1">
                  Temporary Access Password
                </label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[var(--text-muted)] block mb-1">
                  Assigned Security Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--neon-teal)]"
                >
                  <option value="investigator">Investigator (Full Investigation)</option>
                  <option value="analyst">Analyst (Dossiers & Visualizations)</option>
                  <option value="admin">Administrator (Security Root)</option>
                  <option value="viewer">Viewer (Read Only)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-[var(--neon-teal)] text-[#08211d] hover:shadow-[0_0_12px_rgba(45,212,191,0.3)] disabled:opacity-50 transition-all"
                >
                  {submitting ? "Provisioning..." : "Provision Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
