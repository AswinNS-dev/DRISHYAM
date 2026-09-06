import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Network, Users, FolderKanban, Bell,
  LogOut, Brain, Clock, MapPin, Settings,
  Search, CornerDownLeft, Sun, Moon,
  ChevronDown, PanelLeft, ShieldCheck, Shield,
  Database, PhoneCall, ArrowLeftRight, AlertTriangle,
  FileDigit, FileCheck2, Terminal
} from "lucide-react";
import { useAuth } from "../store/auth";
import { useTheme } from "../store/theme";
import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  badge?: string | number;
  adminOnly?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: "INVESTIGATION",
    items: [
      { to: "/dashboard", label: "Investigation Command Center", icon: LayoutDashboard },
      { to: "/cases", label: "Cases", icon: FolderKanban },
      { to: "/entities", label: "Entities", icon: Users },
      { to: "/data-workspace", label: "Data Workspace", icon: Database },
    ],
  },
  {
    group: "ANALYSIS",
    items: [
      { to: "/network", label: "Network", icon: Network },
      { to: "/timeline", label: "Timeline", icon: Clock },
      { to: "/communications", label: "Communications", icon: PhoneCall },
      { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { to: "/locations", label: "Locations & Hotspots", icon: MapPin },
      { to: "/patterns", label: "Patterns & Anomalies", icon: AlertTriangle },
      { to: "/intelligence", label: "AI Insights", icon: Brain },
    ],
  },
  {
    group: "EVIDENCE",
    items: [
      { to: "/evidence", label: "Evidence", icon: FileDigit },
      { to: "/integrity", label: "Verification & Integrity", icon: ShieldCheck },
    ],
  },
  {
    group: "OUTPUT",
    items: [
      { to: "/reports", label: "Reports", icon: FileCheck2 },
    ],
  },
  {
    group: "SECURITY",
    items: [
      { to: "/audit", label: "Audit Log", icon: Terminal },
      { to: "/alerts", label: "Notifications", icon: Bell },
    ],
  },
  {
    group: "SYSTEM",
    items: [
      { to: "/admin", label: "Access & Permissions", icon: Shield, adminOnly: true },
      { to: "/settings", label: "Settings", icon: Settings, adminOnly: true },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [pageKey, setPageKey] = useState(location.pathname);
  const mainRef = useRef<HTMLDivElement>(null);

  const userRole = (user?.role || "").toLowerCase();

  // Close user dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter groups based on user RBAC permissions
  const visibleNavGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item: NavItem) => {
      if (item.adminOnly) {
        return userRole === "admin";
      }
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  // Live Military Clock (IST)
  const [timeStr, setTimeStr] = useState("");
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-IN", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Kolkata",
        }) + " IST"
      );
    }
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Omni-Search Keyboard Shortcut (Ctrl+K / Cmd+K)
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const q = query.toLowerCase();
    const results: any[] = [];
    api.cases().then((r) => {
      (r.cases || []).forEach((c: any) => {
        if (
          c.title?.toLowerCase().includes(q) ||
          c.case_number?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
        ) {
          results.push({
            type: "Case File",
            title: c.title,
            subtitle: `${c.case_number} • ${c.status || "Open"}`,
            route: `/cases?id=${c.id}`,
            category: "CASE",
          });
        }
      });
    }).catch(() => {});

    api.entities("PERSON", query).then((r: any) => {
      (r.entities || []).forEach((en: any) => {
        results.push({
          type: en.type || "Subject",
          title: en.name,
          subtitle: `${en.type} • Priority: ${en.risk_score || "Routine"}`,
          route: `/entities?q=${encodeURIComponent(en.name)}`,
          category: "ENTITY",
        });
      });
      setSearchResults(results.slice(0, 8));
    }).catch(() => {});
  }, [query]);

  // Handle route change transition
  useEffect(() => {
    setPageKey(location.pathname);
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  const initials = user?.full_name 
    ? user.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "IR";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-black text-[#f4f4f5]">
      {/* ── Global Command Palette Modal ── */}
      {searchOpen && (
        <div className="cmd-palette-backdrop" onClick={() => setSearchOpen(false)}>
          <div className="cmd-palette-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-[#0c0c0e]">
              <Search size={16} className="text-zinc-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search cases, subjects, phone numbers, vehicle plates (ESC to close)..."
                className="w-full bg-transparent border-none outline-none text-xs text-white placeholder:text-zinc-600 font-sans"
              />
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                ESC
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1 bg-[#0c0c0e]">
              {!query && (
                <div className="p-3 text-xs text-zinc-500 space-y-2">
                  <div className="font-mono text-[10px] uppercase text-zinc-400 font-semibold">
                    Quick Search Presets
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["Ravi Kumar", "KA01AB1234", "9876543210", "D-Company", "Case-118"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setQuery(s)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 transition-all"
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
                  className="p-2.5 rounded-lg flex items-center justify-between hover:bg-zinc-900 border border-transparent hover:border-zinc-800 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-300">
                      {res.category === "CASE" ? <FolderKanban size={13} /> : <Users size={13} />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{res.title}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{res.subtitle}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">{res.type}</span>
                    <CornerDownLeft size={12} className="text-zinc-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── App Sidebar ── */}
      <aside
        className="shrink-0 flex flex-col relative z-20 select-none bg-black border-r border-[#18181b]"
        style={{
          width: collapsed ? 64 : 240,
          transition: "width 0.2s var(--ease-out-expo)",
        }}
      >
        {/* CrimeIntel Investigation Brand Header */}
        <div className="px-3.5 py-3.5 flex items-center gap-3 border-b border-[#18181b]">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 text-sky-400 font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
            <Shield size={16} className="text-sky-400" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-wider text-white truncate leading-tight font-mono">
                  CRIMEINTEL
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="DRISHYAM Online" />
              </div>
              <div className="text-[10px] font-mono text-zinc-500 truncate tracking-tight">
                INVESTIGATION SUITE
              </div>
            </div>
          )}
        </div>

        {/* Grouped Nav Sections */}
        <nav className="flex-1 px-2.5 space-y-3.5 overflow-y-auto overflow-x-hidden pt-2">
          {visibleNavGroups.map((group) => (
            <div key={group.group} className="space-y-0.5">
              {!collapsed && (
                <div className="px-2.5 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  {group.group}
                </div>
              )}
              {group.items.map(({ to, label, icon: Icon, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      isActive
                        ? "bg-[#1c1c20] text-white font-medium shadow-sm"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-[#121214]"
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon size={14} className="shrink-0 text-zinc-400" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </div>
                  {!collapsed && badge !== undefined && (
                    <span className="text-[11px] font-mono text-zinc-500 pl-2">
                      {badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* ── Footer: Collapse & User Profile ── */}
        <div className="p-2 border-t border-[#18181b] space-y-1">
          {/* Collapse sidebar button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-[#121214] rounded-lg transition-colors cursor-pointer"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft size={15} className="shrink-0 text-zinc-400" />
            {!collapsed && <span>Collapse sidebar</span>}
          </button>

          {/* User profile row with Popover */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-[#121214] transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 font-medium text-[11px] flex items-center justify-center shrink-0 border border-zinc-700/50 font-mono">
                  {initials}
                </div>
                {!collapsed && (
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white truncate leading-tight">
                      {user?.full_name || "Investigating Officer"}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 truncate">
                      {userRole === "admin"
                        ? "System Administrator"
                        : userRole === "investigator"
                        ? "Lead Investigator"
                        : userRole === "analyst" || userRole === "crime_analyst"
                        ? "Crime Analyst"
                        : "Authorized Officer"}
                    </div>
                  </div>
                )}
              </div>
              {!collapsed && <ChevronDown size={14} className="text-zinc-500 shrink-0" />}
            </button>

            {/* User Popover Menu */}
            {userMenuOpen && (
              <div
                className={`absolute bottom-full mb-2 bg-[#0c0c0e] border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in duration-150 ${
                  collapsed ? "left-2 w-52" : "left-0 right-0"
                }`}
              >
                <div className="px-2.5 py-2 border-b border-zinc-800/80 mb-1">
                  <div className="text-xs font-semibold text-white truncate">
                    {user?.full_name || "Investigating Officer"}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono truncate">
                    {user?.email || "officer@crimeintel.gov.in"}
                  </div>
                </div>

                <div className="space-y-0.5 text-xs">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      toggleTheme();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
                      <span>Theme</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 capitalize">{theme}</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate("/settings");
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
                  >
                    <Settings size={13} />
                    <span>Settings</span>
                  </button>
                </div>

                <div className="border-t border-zinc-800/80 my-1" />

                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                    navigate("/login");
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors text-xs font-medium"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main Viewport ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-black">
        {/* Subtle Top Status Bar */}
        <header className="h-12 flex items-center justify-between px-6 shrink-0 bg-black border-b border-[#18181b]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0c0c0e] border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <Search size={13} />
              <span>Search workspace...</span>
              <kbd className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1 rounded">⌘K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500">
              <Clock size={13} className="text-zinc-400" />
              <span>{timeStr}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Online</span>
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main ref={mainRef} className="flex-1 overflow-auto bg-black p-6">
          <div key={pageKey} className="page-enter max-w-7xl mx-auto h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
