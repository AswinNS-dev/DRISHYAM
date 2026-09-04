import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Network, Users, FolderKanban, Upload, Bell, LogOut, Eye } from "lucide-react";
import { useAuth } from "../store/auth";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/network", label: "Network Intelligence", icon: Network },
  { to: "/entities", label: "Entities", icon: Users },
  { to: "/cases", label: "Cases", icon: FolderKanban },
  { to: "/data-import", label: "Data Import", icon: Upload },
  { to: "/alerts", label: "Alerts", icon: Bell },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen" style={{ background: "var(--bg-void)" }}>
      <aside className="w-56 shrink-0 flex flex-col border-r" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="px-4 py-5 flex items-center gap-2">
          <Eye size={20} color="var(--accent-teal)" />
          <div>
            <div className="text-sm font-bold tracking-wide">DRISHYAM</div>
            <div className="text-[10px] text-[var(--text-muted)]">Network Intelligence</div>
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? "bg-[var(--bg-panel-raised)] text-[var(--accent-teal)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-panel)]"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="text-xs text-[var(--text-secondary)] mb-1">{user?.full_name}</div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-3">{user?.role}</div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-red)]"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 flex items-center justify-between px-5 border-b shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
          <span className="badge badge-demo">Demo Data · Synthetic Intelligence</span>
          <span className="text-[11px] text-[var(--text-muted)]">Not real police data</span>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
