import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Network, Users, FolderKanban, Upload, Bell,
  LogOut, Eye, FileText, Brain, Clock, MapPin, Shield, Settings,
  ChevronLeft, ChevronRight, Search, CornerDownLeft, Sun, Moon
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useTheme } from "../store/theme";
import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";

const NAV_GROUPS = [
  {
    group: "OVERVIEW",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    group: "INVESTIGATION",
    items: [
      { to: "/network", label: "Network Intel", icon: Network, highlight: true },
      { to: "/entities", label: "Dossiers & Entities", icon: Users },
      { to: "/cases", label: "Cases", icon: FolderKanban },
      { to: "/firs", label: "FIR Intelligence", icon: FileText },
    ],
  },
  {
    group: "INTELLIGENCE",
    items: [
      { to: "/intelligence", label: "AI Intel & Leads", icon: Brain },
      { to: "/timeline", label: "Timeline", icon: Clock },
      { to: "/locations", label: "Sector Locations", icon: MapPin },
      { to: "/alerts", label: "Alerts & Red Flags", icon: Bell },
    ],
  },
  {
    group: "SYSTEM",
    items: [
      { to: "/data-import", label: "Data Ingestion", icon: Upload },
      { to: "/admin", label: "Security & Admin", icon: Shield },
      { to: "/settings", label: "Engine Config", icon: Settings },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [pageKey, setPageKey] = useState(location.pathname);
  const mainRef = useRef<HTMLDivElement>(null);

  const userRole = (user?.role || "").toLowerCase();
  const visibleNavGroups = NAV_GROUPS.map((group) => {
    if (group.group === "SYSTEM") {
      return {
        ...group,
        items: group.items.filter((item) => {
          if (item.to === "/admin" || item.to === "/settings") {
            return userRole === "admin";
          }
          return true;
        }),
      };
    }
    return group;
  }).filter((group) => group.items.length > 0);

  // Live Military Clock
  const [timeStr, setTimeStr] = useState("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
        " IST"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Global Command Palette / Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Auto focus input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setSearchResults([]);
    }
  }, [searchOpen]);

  // Query global search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearchLoading(true);
      api.globalSearch(query)
        .then((res) => setSearchResults(res.results || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

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

  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const currentPageLabel = allItems.find((n) => location.pathname.startsWith(n.to))?.label || "Workspace";

  return (
    <div className="flex h-screen" style={{ background: "var(--bg-void)" }}>
      {/* ── Global Search Modal (Command Palette) ── */}
      {searchOpen && (
        <div className="cmd-palette-backdrop" onClick={() => setSearchOpen(false)}>
          <div className="cmd-palette-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center px-4 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel-raised)]">
              <Search size={16} className="text-[var(--neon-teal)] mr-3 shrink-0" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search across Persons, Cases, Vehicles, Phones, Gangs... (Type to explore)"
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] font-sans"
              />
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                ESC
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {searchLoading && (
                <div className="py-6 text-center text-xs font-mono text-[var(--neon-teal)]">
                  Scanning intelligence databases...
                </div>
              )}

              {!searchLoading && query && searchResults.length === 0 && (
                <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                  No matching entities or case files found for "{query}".
                </div>
              )}

              {!query && (
                <div className="p-4 text-xs text-[var(--text-muted)] space-y-2">
                  <div className="font-mono text-[10px] uppercase text-[var(--neon-teal)]">Quick Suggestions</div>
                  <div className="flex flex-wrap gap-2">
                    {["Ravi Kumar", "KA01AB1234", "9876543210", "D-Company", "Case-118"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setQuery(s)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] hover:border-[var(--neon-teal)] text-[var(--text-secondary)] transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.map((res, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setSearchOpen(false);
                    navigate(res.route);
                  }}
                  className="p-3 rounded-lg flex items-center justify-between hover:bg-[var(--bg-panel-hover)] border border-transparent hover:border-[var(--border-subtle)] cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[rgba(45,212,191,0.1)] border border-[rgba(45,212,191,0.2)] text-[var(--neon-teal)]">
                      {res.category === "CASE" ? <FolderKanban size={14} /> : <Users size={14} />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">{res.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)] font-mono">{res.subtitle}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge badge-low text-[9px]">{res.type}</span>
                    <CornerDownLeft size={12} className="text-[var(--text-muted)]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside
        className="shrink-0 flex flex-col relative z-20"
        style={{
          width: collapsed ? 68 : 240,
          transition: "width 0.3s var(--ease-out-expo)",
          background: "var(--bg-panel-solid)",
          backdropFilter: "blur(20px) saturate(1.8)",
          borderRight: "1px solid var(--border-subtle)",
          boxShadow: "4px 0 30px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Neon left accent edge */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: "linear-gradient(180deg, var(--neon-teal), transparent 70%)",
            opacity: 0.6,
          }}
        />

        {/* Logo */}
        <div className="px-4 py-4 flex items-center gap-3 relative border-b border-[var(--border-subtle)]">
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "linear-gradient(135deg, rgba(45,212,191,0.2), rgba(0,255,255,0.06))",
              border: "1px solid rgba(45,212,191,0.35)",
              boxShadow: "0 0 16px rgba(45,212,191,0.2)",
            }}
          >
            <Eye size={18} color="var(--neon-teal)" style={{ filter: "drop-shadow(0 0 6px rgba(0,255,255,0.6))" }} />
          </div>
          {!collapsed && (
            <div className="fade-in min-w-0">
              <div
                className="text-sm font-black tracking-widest leading-tight"
                style={{ color: "var(--neon-teal)", textShadow: "0 0 12px rgba(45,212,191,0.4)" }}
              >
                DRISHYAM
              </div>
              <div className="hud-label" style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.15em" }}>
                SIH26189 · CRIME INTEL
              </div>
            </div>
          )}
        </div>

        {/* Global Search Trigger in Sidebar */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-[var(--neon-teal)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
          >
            <div className="flex items-center gap-2 truncate">
              <Search size={14} className="text-[var(--neon-teal)] shrink-0" />
              {!collapsed && <span className="truncate text-[11px]">Omni-Search...</span>}
            </div>
            {!collapsed && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[var(--text-muted)]">
                Ctrl+K
              </span>
            )}
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-2.5 py-2 space-y-4 overflow-y-auto overflow-x-hidden">
          {visibleNavGroups.map((group) => (
            <div key={group.group} className="space-y-1">
              {!collapsed && (
                <div className="px-2 pt-1 pb-0.5 text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)] opacity-70">
                  {group.group}
                </div>
              )}
              {group.items.map(({ to, label, icon: Icon, highlight }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all relative ${
                      isActive
                        ? "text-[var(--neon-teal)] font-semibold"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-hover)]"
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? {
                          background: "rgba(45, 212, 191, 0.08)",
                          boxShadow: "inset 3px 0 12px rgba(0, 255, 255, 0.06)",
                          borderLeft: "2px solid var(--neon-teal)",
                        }
                      : { borderLeft: "2px solid transparent" }
                  }
                >
                  <Icon
                    size={16}
                    style={{ flexShrink: 0 }}
                    className={highlight ? "text-[var(--neon-teal)]" : undefined}
                  />
                  {!collapsed && (
                    <span className="truncate flex-1 flex items-center justify-between">
                      <span>{label}</span>
                      {highlight && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-teal)] animate-pulse" />
                      )}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Officer User Section */}
        <div className="px-3 py-3 border-t border-[var(--border-subtle)] bg-[rgba(6,9,15,0.4)]">
          <div className="flex items-center gap-2.5">
            <div className="avatar shrink-0" style={{ width: 30, height: 30, fontSize: 11 }}>
              {user?.full_name?.charAt(0)?.toUpperCase() || "O"}
            </div>
            {!collapsed && (
              <div className="min-w-0 fade-in flex-1">
                <div className="text-xs font-semibold truncate text-[var(--text-primary)]">{user?.full_name || "Investigator"}</div>
                <div className="badge badge-info text-[8px] py-0 px-1.5 mt-0.5 font-mono uppercase font-bold tracking-wider">
                  {user?.role === "admin" ? "ROOT ADMIN" : user?.role === "investigator" ? "LEAD INVESTIGATOR" : "CRIME ANALYST"}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-2 text-xs mt-2.5 w-full px-2 py-1 rounded-md text-[var(--text-muted)] hover:text-[var(--neon-red)] hover:bg-[rgba(255,59,92,0.06)] transition-colors"
          >
            <LogOut size={13} />
            {!collapsed && <span className="text-[11px]">Terminate Session</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-5 -right-3 w-6 h-6 rounded-full flex items-center justify-center z-50 bg-[var(--bg-panel-solid)] border border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--neon-teal)] hover:border-[var(--neon-teal)] transition-all cursor-pointer shadow-md"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* ── Main Workspace Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Intelligence Telemetry Bar */}
        <header
          className="h-12 flex items-center justify-between px-5 shrink-0 bg-[var(--bg-panel-solid)] border-b border-[var(--border-subtle)]"
          style={{ backdropFilter: "blur(12px)" }}
        >
          <div className="flex items-center gap-3">
            <span className="hud-label text-[11px] font-bold text-[var(--neon-teal)] tracking-wider">
              {currentPageLabel}
            </span>
            <span className="text-[var(--border-strong)]">/</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[rgba(251,191,36,0.06)] border border-[rgba(251,191,36,0.2)]">
              <span className="radar-beacon" style={{ background: "var(--neon-amber)", width: 6, height: 6 }} />
              <span className="text-[9px] font-mono text-[var(--neon-amber)] uppercase font-semibold">
                Classified Synthetic Sandbox
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Officer Clearance Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-[10px] font-mono">
              <Shield size={11} className="text-[var(--neon-teal)]" />
              <span className="text-[var(--text-muted)]">CLEARANCE:</span>
              <span className="text-[var(--text-primary)] font-bold uppercase">
                {user?.role || "analyst"}
              </span>
            </div>

            {/* Session Heartbeat */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[rgba(45,212,191,0.08)] border border-[rgba(45,212,191,0.25)]">
              <span className="radar-beacon" style={{ background: "var(--neon-teal)", width: 6, height: 6 }} />
              <span className="text-[9px] font-mono text-[var(--neon-teal)] uppercase font-semibold">
                Session Active (30m)
              </span>
            </div>

            {/* Live Clock HUD */}
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-panel-raised)] px-2.5 py-1 rounded-md border border-[var(--border-subtle)]">
              <Clock size={12} className="text-[var(--neon-teal)]" />
              <span>{timeStr}</span>
            </div>

            {/* Theme Toggle (Light / Dark) */}
            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-[var(--neon-teal)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            >
              {theme === "dark" ? (
                <>
                  <Sun size={12} className="text-[var(--neon-amber)]" />
                  <span className="font-mono text-[10px]">Light</span>
                </>
              ) : (
                <>
                  <Moon size={12} className="text-[var(--neon-teal)]" />
                  <span className="font-mono text-[10px]">Dark</span>
                </>
              )}
            </button>

            {/* Grid Status */}
            <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)]">
              <div className="w-2 h-2 rounded-full bg-[var(--neon-teal)] animate-ping" />
              <span className="text-[var(--neon-teal)] font-bold">GRID ONLINE</span>
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main ref={mainRef} className="flex-1 overflow-auto">
          <div key={pageKey} className="page-enter h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
