import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Network, Users, FolderKanban, Upload, Bell,
  LogOut, Eye, FileText, Brain, Clock, MapPin, Shield, Settings,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useState, useEffect, useRef } from "react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/network", label: "Network Intel", icon: Network },
  { to: "/entities", label: "Entities", icon: Users },
  { to: "/cases", label: "Cases", icon: FolderKanban },
  { to: "/firs", label: "FIRs", icon: FileText },
  { to: "/intelligence", label: "Intelligence", icon: Brain },
  { to: "/timeline", label: "Timeline", icon: Clock },
  { to: "/locations", label: "Locations", icon: MapPin },
  { to: "/data-import", label: "Data Import", icon: Upload },
  { to: "/alerts", label: "Alerts", icon: Bell },
];

const ADMIN_NAV = [
  { to: "/admin", label: "Admin", icon: Shield },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [pageKey, setPageKey] = useState(location.pathname);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageKey(location.pathname);
  }, [location.pathname]);

  // Auto-collapse on narrow screens
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1024px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setCollapsed(true);
    };
    handler(mql);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const currentPageLabel = [...NAV, ...ADMIN_NAV].find(
    (n) => location.pathname.startsWith(n.to)
  )?.label || "Dashboard";

  return (
    <div className="flex h-screen" style={{ background: "var(--bg-void)" }}>
      {/* ── Sidebar ── */}
      <aside
        className="shrink-0 flex flex-col relative"
        style={{
          width: collapsed ? 64 : 220,
          transition: "width 0.3s var(--ease-out-expo)",
          background: "var(--bg-panel)",
          backdropFilter: "blur(20px) saturate(1.8)",
          borderRight: "1px solid var(--border-subtle)",
          boxShadow: "1px 0 30px rgba(0, 0, 0, 0.3)",
        }}
      >
        {/* Neon left edge */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 1,
            background: "linear-gradient(180deg, transparent, var(--neon-teal), transparent)",
            opacity: 0.3,
          }}
        />

        {/* Logo */}
        <div className="px-4 py-5 flex items-center gap-3 relative">
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, rgba(45,212,191,0.15), rgba(0,255,255,0.08))",
              border: "1px solid rgba(45,212,191,0.25)",
              boxShadow: "0 0 16px rgba(0,255,255,0.1)",
            }}
          >
            <Eye size={16} color="var(--neon-teal)" style={{ filter: "drop-shadow(0 0 6px rgba(0,255,255,0.4))" }} />
          </div>
          {!collapsed && (
            <div className="fade-in">
              <div
                className="text-sm font-bold tracking-wider"
                style={{ color: "var(--neon-teal)", textShadow: "0 0 12px rgba(45,212,191,0.3)" }}
              >
                DRISHYAM
              </div>
              <div className="hud-label" style={{ fontSize: 8, marginTop: 1 }}>
                Network Intelligence
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all relative ${
                  isActive
                    ? "text-[var(--neon-teal)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-hover)]"
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      background: "rgba(45, 212, 191, 0.06)",
                      boxShadow: "inset 3px 0 12px rgba(0, 255, 255, 0.05)",
                      borderLeft: "2px solid var(--neon-teal)",
                    }
                  : { borderLeft: "2px solid transparent" }
              }
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}

          {/* Admin section divider */}
          {(user?.role === "admin" || true) && (
            <>
              <div
                className="mx-3 my-3"
                style={{
                  height: 1,
                  background:
                    "linear-gradient(90deg, transparent, var(--border-strong), transparent)",
                }}
              />
              {ADMIN_NAV.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                      isActive
                        ? "text-[var(--neon-teal)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-panel-hover)]"
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? {
                          background: "rgba(45, 212, 191, 0.06)",
                          borderLeft: "2px solid var(--neon-teal)",
                        }
                      : { borderLeft: "2px solid transparent" }
                  }
                >
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User section */}
        <div className="px-3 py-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-3">
            <div className="avatar shrink-0">
              {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            {!collapsed && (
              <div className="min-w-0 fade-in">
                <div className="text-xs font-medium truncate">{user?.full_name}</div>
                <div className="badge badge-info" style={{ fontSize: 8, padding: "1px 6px", marginTop: 2 }}>
                  {user?.role}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-2 text-xs mt-3 w-full px-2 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neon-red)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <LogOut size={14} />
            {!collapsed && "Sign out"}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-6 -right-3 w-6 h-6 rounded-full flex items-center justify-center z-50"
          style={{
            background: "var(--bg-panel-solid)",
            border: "1px solid var(--border-strong)",
            boxShadow: "0 0 8px rgba(0,0,0,0.4)",
            color: "var(--text-muted)",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--neon-teal)";
            e.currentTarget.style.color = "var(--neon-teal)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-strong)";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar */}
        <header
          className="h-12 flex items-center justify-between px-5 shrink-0"
          style={{
            background: "var(--bg-panel)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="hud-label" style={{ color: "var(--neon-teal)", fontSize: 11 }}>
              {currentPageLabel}
            </span>
            <span style={{ color: "var(--border-strong)" }}>·</span>
            <span className="badge badge-demo" style={{ fontSize: 9, padding: "2px 8px" }}>
              Synthetic Data
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="glow-dot glow-dot-teal pulse-dot" style={{ width: 6, height: 6 }} />
              <span className="hud-label" style={{ fontSize: 9 }}>LIVE ANALYSIS</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main ref={mainRef} className="flex-1 overflow-auto">
          <div key={pageKey} className="page-enter h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
