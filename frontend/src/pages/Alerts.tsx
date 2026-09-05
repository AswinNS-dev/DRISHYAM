import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Check, AtSign, GitPullRequest, MessageSquare,
  UserPlus, ShieldCheck, AlertTriangle
} from "lucide-react";

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "mentions">("all");
  const [markedRead, setMarkedRead] = useState(false);

  useEffect(() => {
    api.alerts()
      .then((r) => setAlerts(r.alerts || []))
      .catch(() => {});
  }, []);

  const totalCount = alerts.length || 8;
  const unreadCount = markedRead ? 0 : 4;
  const mentionsCount = 2;

  // Mocked/adapted structured notifications matching Screenshot 3
  const notificationsList = [
    {
      id: "n1",
      section: "TODAY",
      icon: AtSign,
      title: "Ana Reyes",
      action: "mentioned you in Q3 rollout plan",
      body: "Can you confirm the migration window before we lock the schedule with Northwind?",
      time: "12m",
      unread: true,
      category: "mentions",
    },
    {
      id: "n2",
      section: "TODAY",
      icon: GitPullRequest,
      title: "Wei Chen",
      action: "requested review on Billing usage meter",
      body: "14 files changed across the metering service and the invoice job.",
      time: "48m",
      unread: true,
      category: "unread",
    },
    {
      id: "n3",
      section: "TODAY",
      icon: MessageSquare,
      title: "Marco Silva",
      action: "replied in Onboarding checklist",
      body: "Moved the workspace step ahead of the invite step. Looks cleaner.",
      time: "2h",
      unread: false,
      category: "all",
    },
    {
      id: "n4",
      section: "TODAY",
      icon: UserPlus,
      title: "Priya Nandakumar",
      action: "joined Cedar Labs",
      body: "Invited by you as an editor.",
      time: "5h",
      unread: false,
      category: "all",
    },
    {
      id: "n5",
      section: "YESTERDAY",
      icon: ShieldCheck,
      title: "Halcyon",
      action: "signed in from a new device on macOS • Lisbon",
      body: "If this was not you, revoke the session and rotate your keys.",
      time: "Yesterday",
      unread: false,
      category: "unread",
    },
    {
      id: "n6",
      section: "YESTERDAY",
      icon: AtSign,
      title: "Sofia Alvarez",
      action: "mentioned you in Retention teardown",
      body: "Pulled your cohort chart into the summary. Shout if that is stale.",
      time: "Yesterday",
      unread: false,
      category: "mentions",
    },
  ];

  const filtered = notificationsList.filter((n) => {
    if (filter === "unread") return n.unread && !markedRead;
    if (filter === "mentions") return n.category === "mentions";
    return true;
  });

  const todayItems = filtered.filter((n) => n.section === "TODAY");
  const yesterdayItems = filtered.filter((n) => n.section === "YESTERDAY");

  return (
    <div className="w-full max-w-5xl mx-auto page-enter py-4">
      {/* ── Exact Match to Screenshot 3 (Notifications Container) ── */}
      <div className="bg-[#0c0c0e] border border-zinc-800/80 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6">
        {/* Header Strip */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-semibold text-white tracking-tight">
              Notifications
            </h1>
            <span className="bg-white text-black font-bold text-xs px-2 py-0.5 rounded-full leading-none">
              {unreadCount}
            </span>
          </div>

          <button
            onClick={() => setMarkedRead(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-xs text-zinc-300 transition-colors cursor-pointer"
          >
            <Check size={13} className="text-zinc-400" />
            <span>Mark all read</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              filter === "all"
                ? "border border-zinc-700 bg-zinc-800/60 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            All {totalCount}
          </button>

          <button
            onClick={() => setFilter("unread")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              filter === "unread"
                ? "border border-zinc-700 bg-zinc-800/60 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Unread {unreadCount}
          </button>

          <button
            onClick={() => setFilter("mentions")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              filter === "mentions"
                ? "border border-zinc-700 bg-zinc-800/60 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Mentions {mentionsCount}
          </button>
        </div>

        {/* List Section: TODAY */}
        {todayItems.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500 px-1 pt-1 pb-1">
              TODAY
            </div>
            <div className="space-y-1">
              {todayItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between py-3 px-2 rounded-xl hover:bg-zinc-900/40 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs leading-normal">
                          <span className="font-semibold text-white">{item.title}</span>{" "}
                          <span className="text-zinc-300">{item.action}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5 leading-normal">
                          {item.body}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-zinc-500 shrink-0 ml-4">
                      {item.time}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* List Section: YESTERDAY */}
        {yesterdayItems.length > 0 && (
          <div className="space-y-1 pt-2">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500 px-1 pt-1 pb-1">
              YESTERDAY
            </div>
            <div className="space-y-1">
              {yesterdayItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between py-3 px-2 rounded-xl hover:bg-zinc-900/40 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs leading-normal">
                          <span className="font-semibold text-white">{item.title}</span>{" "}
                          <span className="text-zinc-300">{item.action}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5 leading-normal">
                          {item.body}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-zinc-500 shrink-0 ml-4">
                      {item.time}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Backend Alerts Integration */}
        {alerts.length > 0 && (
          <div className="space-y-1 pt-3 border-t border-zinc-800/60">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500 px-1 pt-1 pb-1">
              TACTICAL FLAGS
            </div>
            <div className="space-y-1">
              {alerts.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between py-3 px-2 rounded-xl hover:bg-zinc-900/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                      <AlertTriangle size={13} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white">
                        {a.what_happened}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {a.why_it_matters}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-zinc-500 shrink-0 ml-4">
                    {Math.round((a.confidence || 0.8) * 100)}% match
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Sub-header */}
        <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-600 px-1 pt-1">
          EARLIER
        </div>
      </div>
    </div>
  );
}
