import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  CreditCard, Search, Filter, RefreshCw, ArrowRight,
  Building2, FolderOpen, X, Clock, ChevronRight, BarChart2,
  ShieldAlert, CheckCircle2, TrendingUp
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from "recharts";

export default function Transactions() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramEntityId = searchParams.get("entity_id") || "";
  const paramCaseId = searchParams.get("case_id") || "";

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minAmount, setMinAmount] = useState<number>(0);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(paramCaseId);
  const [selectedEntityId, setSelectedEntityId] = useState<string>(paramEntityId);
  const [showChart, setShowChart] = useState(true);
  const [caseList, setCaseList] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalVolume: 0, flaggedCount: 0, totalRecords: 0 });

  useEffect(() => {
    api.cases().then((res) => setCaseList(res.cases || [])).catch(() => {});
  }, []);

  function loadTransactions() {
    setLoading(true);
    api.transactions({
      entity_id: selectedEntityId || undefined,
      case_id: selectedCaseId || undefined,
      q: search || undefined,
      min_amount: minAmount || undefined,
    })
      .then((res) => {
        setTransactions(res.transactions || []);
        setStats({
          totalVolume: res.total_volume || 0,
          flaggedCount: res.flagged_count || 0,
          totalRecords: res.total_records || 0,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadTransactions();
  }, [search, minAmount, selectedCaseId, selectedEntityId]);

  // Aggregate real transaction data for the volume chart
  const chartData = useMemo(() => {
    if (!transactions.length) return [];
    const dateMap = new Map<string, number>();
    transactions.forEach((t) => {
      const d = new Date(t.timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
      dateMap.set(d, (dateMap.get(d) || 0) + (t.amount || 0));
    });
    return Array.from(dateMap.entries()).map(([date, volume]) => ({
      date,
      volume: Math.round(volume),
    })).slice(-12);
  }, [transactions]);

  const selectedCaseObj = caseList.find((c) => c.id === selectedCaseId);

  const getBankBadgeStyle = (bankName: string) => {
    const name = (bankName || "").toUpperCase();
    if (name.includes("ICICI")) return "bg-orange-950/80 border-orange-700/60 text-orange-400";
    if (name.includes("HDFC")) return "bg-red-950/80 border-red-700/60 text-red-400";
    if (name.includes("SBI")) return "bg-blue-950/80 border-blue-700/60 text-blue-400";
    if (name.includes("CANARA")) return "bg-amber-950/80 border-amber-700/60 text-amber-400";
    return "bg-indigo-950/80 border-indigo-700/60 text-indigo-400";
  };

  return (
    <div className="flex flex-col h-full bg-[#020617]">
      {/* ── Top Header Strip ── */}
      <div className="px-6 py-4 border-b border-slate-800/90 space-y-3 bg-slate-900/95 backdrop-blur-md">
        {/* Module Metadata Line */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge badge-info text-[10px] font-mono tracking-wider font-bold py-0.5 px-2 bg-slate-800 text-sky-300 border border-sky-500/30 text-glow-sky">
              STATE FINANCIAL INTELLIGENCE & TRANSACTION LEDGER
            </span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 text-glow-emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE DATABASE SYNCHRONIZED
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Financial Ledger: <span className="text-white font-bold">{stats.totalRecords}</span> Audited Transactions
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-emerald-400 border border-slate-800 flex items-center justify-center shadow-md">
              <CreditCard size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black tracking-wide text-white uppercase text-glow-white">
                  Financial Transaction Intelligence
                </h1>
                <span className="badge bg-emerald-950/80 border-emerald-800/80 text-emerald-300 text-[8px] font-mono">
                  FIU LINKAGE ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Audited banking conduits, institutional ledgers, and monitored account-to-account capital transfers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowChart((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer shadow-sm ${
                showChart
                  ? "bg-slate-800 text-emerald-300 border-emerald-500/40 text-glow-emerald font-bold"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
              title="Toggle Volume Trend Chart"
            >
              <BarChart2 size={13} />
              <span>{showChart ? "Hide Trend Chart" : "Show Trend Chart"}</span>
            </button>

            <button
              onClick={loadTransactions}
              className="p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white bg-slate-950 transition-all cursor-pointer shadow-sm"
              title="Refresh Transactions"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-emerald-400" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Financial Metrics Visual KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b border-slate-800/90 bg-slate-900/90">
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-sky-400 uppercase tracking-wider font-semibold">Total Indexed Ledger</span>
            <Building2 size={13} className="text-sky-400" />
          </div>
          <div className="text-xl font-black font-mono text-white text-glow-white mt-1">{stats.totalRecords}</div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">Audited records</div>
        </div>

        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">Total Monitored Flow</span>
            <TrendingUp size={13} className="text-emerald-400" />
          </div>
          <div className="text-xl font-black font-mono text-emerald-300 text-glow-emerald mt-1">
            ₹{stats.totalVolume.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] font-mono text-emerald-400/80 mt-0.5">Aggregate volume</div>
        </div>

        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-semibold">High Volume Triggers</span>
            <ShieldAlert size={13} className="text-amber-400" />
          </div>
          <div className="text-xl font-black font-mono text-amber-300 text-glow-amber mt-1">
            {stats.flaggedCount} Transfers
          </div>
          <div className="text-[10px] font-mono text-amber-400/80 mt-0.5">≥ ₹1,50,000 threshold</div>
        </div>

        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">Compliance Filter</span>
            <CheckCircle2 size={13} className="text-cyan-400" />
          </div>
          <div className="text-xs font-mono font-bold text-cyan-300 text-glow-cyan mt-1.5">PMLA CTR/STR Standard</div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">Automated surveillance</div>
        </div>
      </div>

      {/* ── Real Capital Flow Chart (Recharts) ── */}
      {showChart && chartData.length > 0 && (
        <div className="px-6 py-3 border-b border-slate-800/90 bg-slate-900/95">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono uppercase text-emerald-400 font-semibold tracking-wider flex items-center gap-1.5 text-glow-emerald">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Capital Transfer Volume Over Time (Real Ingested Ledger Data)</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">Values in INR (₹)</div>
          </div>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <defs>
                  <linearGradient id="emeraldBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#047857" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={{ stroke: "#334155" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 9 }}
                  axisLine={{ stroke: "#334155" }}
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "#020617", border: "1px solid #10b981", borderRadius: 8, fontSize: 11 }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, "Volume"]}
                />
                <Bar dataKey="volume" fill="url(#emeraldBarGradient)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Filter Controls ── */}
      <div className="px-6 py-2.5 border-b border-slate-800/90 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by holder name, masked account (XXXX7788), bank..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500"
            />
          </div>

          {/* Case Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
            <FolderOpen size={12} className="text-sky-400" />
            <select
              value={selectedCaseId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCaseId(val);
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  if (val) next.set("case_id", val);
                  else next.delete("case_id");
                  return next;
                });
              }}
              className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer max-w-[150px] truncate font-mono"
            >
              <option value="" className="bg-slate-900 text-slate-300">All Cases (Global)</option>
              {caseList.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-slate-200">
                  {c.case_number}: {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-lg px-2.5 py-1">
            <Filter size={12} className="text-amber-400" />
            <select
              value={minAmount}
              onChange={(e) => setMinAmount(Number(e.target.value))}
              className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer"
            >
              <option value={0} className="bg-slate-900 text-slate-300">All Amounts</option>
              <option value={50000} className="bg-slate-900 text-slate-200">Above ₹50,000</option>
              <option value={150000} className="bg-slate-900 text-amber-300 font-semibold">Above ₹1,50,000 (PMLA)</option>
              <option value={500000} className="bg-slate-900 text-rose-300 font-semibold">Above ₹5,00,000 (Critical)</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400">
          <span className="text-emerald-400 font-bold">{transactions.length}</span> Ledger Records
        </div>
      </div>

      {/* ── Active Scope Banner ── */}
      {(selectedCaseId || selectedEntityId) && (
        <div className="px-6 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase text-sky-400 font-semibold">Active Scope:</span>
            {selectedCaseId && (
              <span className="badge bg-sky-950/80 border-sky-700 text-sky-300 text-[10px] font-mono">
                Case: {selectedCaseObj?.case_number || selectedCaseId.slice(0, 8)}
              </span>
            )}
            {selectedEntityId && (
              <span className="badge bg-purple-950/80 border-purple-700 text-purple-300 text-[10px] font-mono">
                Entity Scoped: {selectedEntityId.slice(0, 8)}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setSelectedCaseId("");
              setSelectedEntityId("");
              setSearchParams({});
            }}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
          >
            <X size={12} />
            <span>Clear Filter Context</span>
          </button>
        </div>
      )}

      {/* ── Table Feed Header (Strict 12-Column Alignment) ── */}
      <div className="hidden lg:grid grid-cols-12 gap-4 px-10 py-2.5 bg-slate-950 border-b border-slate-800/80 text-[10px] font-mono uppercase tracking-wider text-slate-400 select-none">
        <div className="col-span-3 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
          <span>Remitter / Source Account</span>
        </div>
        <div className="col-span-1 text-center">Conduit</div>
        <div className="col-span-3 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
          <span>Beneficiary / Destination</span>
        </div>
        <div className="col-span-2 text-right">Amount (INR)</div>
        <div className="col-span-1 text-right">Settlement</div>
        <div className="col-span-1 text-center">Regulatory</div>
        <div className="col-span-1 text-right">Actions</div>
      </div>

      {/* ── Table Rows Feed ── */}
      <div className="flex-1 p-6 overflow-y-auto space-y-2.5">
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-16 rounded-lg" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="panel p-12 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-panel-solid)] rounded-lg">
            <CreditCard size={32} className="mx-auto mb-2 opacity-30 text-emerald-400" />
            <div className="font-semibold text-[var(--text-secondary)] uppercase">No transactions matched</div>
            <p className="mt-1 text-[11px] text-slate-400">
              {selectedEntityId || selectedCaseId
                ? "No financial transfers found for this active scope."
                : "No financial transfers met the filtering criteria."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((txn) => (
              <div
                key={txn.id}
                className={`panel p-3.5 rounded-lg border transition-all ${
                  txn.flagged
                    ? "bg-gradient-to-r from-amber-950/20 via-slate-900/90 to-slate-900 border-l-4 border-l-amber-500 border-slate-800 hover:border-amber-500/50 shadow-sm"
                    : "bg-gradient-to-r from-emerald-950/10 via-slate-900/90 to-slate-900 border-l-4 border-l-emerald-500/70 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-center">
                  
                  {/* Remitter / Source Account (Col 1-3) */}
                  <div className="lg:col-span-3 flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-mono text-[10px] font-bold border shadow-inner ${getBankBadgeStyle(
                        txn.sender_bank
                      )}`}
                      title={txn.sender_bank}
                    >
                      {txn.sender_bank ? txn.sender_bank.slice(0, 2).toUpperCase() : "BK"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-mono text-slate-400 uppercase lg:hidden">
                        Remitter
                      </div>
                      <div
                        onClick={() =>
                          txn.sender_id &&
                          navigate(`/network?entity_id=${txn.sender_id}${selectedCaseId ? `&case_id=${selectedCaseId}` : ""}`)
                        }
                        className="text-xs font-bold text-slate-100 hover:text-sky-400 cursor-pointer truncate transition-colors"
                        title={txn.sender_name}
                      >
                        {txn.sender_name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1 truncate">
                        <span className="text-slate-300 font-medium">{txn.sender_bank}</span>
                        <span>•</span>
                        <span className="text-slate-400">{txn.sender_account}</span>
                      </div>
                    </div>
                  </div>

                  {/* Flow Conduit / Wire Arrow (Col 4) */}
                  <div className="lg:col-span-1 flex items-center justify-start lg:justify-center">
                    <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700 text-slate-400">
                      <span className="text-[9px] font-mono text-emerald-400">WIRE</span>
                      <ArrowRight size={11} className="text-emerald-400" />
                    </div>
                  </div>

                  {/* Beneficiary / Destination (Col 5-7) */}
                  <div className="lg:col-span-3 flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-mono text-[10px] font-bold border shadow-inner ${getBankBadgeStyle(
                        txn.receiver_bank
                      )}`}
                      title={txn.receiver_bank}
                    >
                      {txn.receiver_bank ? txn.receiver_bank.slice(0, 2).toUpperCase() : "BK"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-mono text-slate-400 uppercase lg:hidden">
                        Beneficiary
                      </div>
                      <div
                        onClick={() =>
                          txn.receiver_id &&
                          navigate(`/network?entity_id=${txn.receiver_id}${selectedCaseId ? `&case_id=${selectedCaseId}` : ""}`)
                        }
                        className="text-xs font-bold text-slate-100 hover:text-sky-400 cursor-pointer truncate transition-colors"
                        title={txn.receiver_name}
                      >
                        {txn.receiver_name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1 truncate">
                        <span className="text-slate-300 font-medium">{txn.receiver_bank}</span>
                        <span>•</span>
                        <span className="text-slate-400">{txn.receiver_account}</span>
                      </div>
                    </div>
                  </div>

                  {/* Amount in INR (Col 8-9) */}
                  <div className="lg:col-span-2 text-left lg:text-right">
                    <div className="text-[10px] font-mono text-slate-400 uppercase lg:hidden">
                      Amount
                    </div>
                    <div
                      className={`font-mono font-bold text-sm inline-block px-2.5 py-1 rounded-md ${
                        txn.flagged
                          ? "text-amber-300 bg-amber-950/60 border border-amber-600/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                          : "text-emerald-400 bg-emerald-950/40 border border-emerald-800/40"
                      }`}
                    >
                      ₹{txn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Settlement Timestamp (Col 10) */}
                  <div className="lg:col-span-1 text-left lg:text-right font-mono text-[10px] text-slate-300">
                    <div className="text-[10px] font-mono text-slate-400 uppercase lg:hidden">
                      Settlement Date
                    </div>
                    <div className="font-semibold text-slate-200">
                      {new Date(txn.timestamp).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })}
                    </div>
                    <div className="text-slate-400">
                      {new Date(txn.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  {/* Regulatory PMLA / Cleared Badge (Col 11) */}
                  <div className="lg:col-span-1 flex items-center justify-start lg:justify-center">
                    {txn.flagged ? (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-600/60 flex items-center gap-1 shadow-sm whitespace-nowrap">
                        <ShieldAlert size={10} className="text-amber-400" />
                        <span>PMLA</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 flex items-center gap-1 whitespace-nowrap">
                        <CheckCircle2 size={10} className="text-emerald-400" />
                        <span>CLEARED</span>
                      </span>
                    )}
                  </div>

                  {/* Actions (Col 12) */}
                  <div className="lg:col-span-1 flex items-center justify-end gap-1.5">
                    {txn.sender_id && (
                      <button
                        onClick={() =>
                          navigate(
                            `/timeline?entity_id=${txn.sender_id}${
                              selectedCaseId ? `&case_id=${selectedCaseId}` : ""
                            }`
                          )
                        }
                        className="p-1.5 rounded-md bg-slate-800/90 border border-slate-700 hover:border-sky-400 hover:bg-sky-950/60 text-slate-300 hover:text-sky-300 transition-all cursor-pointer shadow-sm"
                        title="View Sender in Chronological Timeline"
                      >
                        <Clock size={12} />
                      </button>
                    )}
                    {txn.sender_id && (
                      <button
                        onClick={() =>
                          navigate(
                            `/network?entity_id=${txn.sender_id}${
                              selectedCaseId ? `&case_id=${selectedCaseId}` : ""
                            }`
                          )
                        }
                        className="p-1.5 rounded-md bg-slate-800/90 border border-slate-700 hover:border-sky-400 hover:bg-sky-950/60 text-slate-300 hover:text-sky-300 transition-all cursor-pointer shadow-sm"
                        title="Explore Sender in Network Intelligence"
                      >
                        <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
