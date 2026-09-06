import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  CreditCard, Search, Filter, RefreshCw, ArrowRight,
  Building2
} from "lucide-react";

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minAmount, setMinAmount] = useState<number>(0);
  const [stats, setStats] = useState({ totalVolume: 0, flaggedCount: 0, totalRecords: 0 });

  function loadTransactions() {
    setLoading(true);
    api.transactions({ q: search || undefined, min_amount: minAmount || undefined })
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
  }, [search, minAmount]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-void)]">
      {/* ── Top Header Strip ── */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-panel-solid)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700/60 flex items-center justify-center shadow-sm">
            <CreditCard size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold tracking-wide uppercase text-[var(--text-primary)]">
                Financial Transaction Intelligence
              </h1>
              <span className="badge badge-low text-[8px]">FIU LINKAGE</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Audited banking conduits, hawala trails, and suspect-to-suspect fund transfers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadTransactions}
            className="p-1.5 rounded border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-panel-raised)] transition-all"
            title="Refresh Transactions"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[var(--intel-sky)]" : ""} />
          </button>
        </div>
      </div>

      {/* ── Financial Metrics Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Total Indexed Transactions</div>
          <div className="text-base font-bold font-mono text-[var(--text-bright)] mt-0.5">{stats.totalRecords}</div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Monitored Capital Flow</div>
          <div className="text-base font-bold font-mono text-[var(--intel-sky)] mt-0.5">
            ₹{stats.totalVolume.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Suspicious / High-Value</div>
          <div className="text-base font-bold font-mono text-[var(--status-warning)] mt-0.5">
            {stats.flaggedCount} transfers
          </div>
        </div>
        <div className="panel p-2.5 bg-[var(--bg-panel-raised)]">
          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Surveillance Threshold</div>
          <div className="text-xs font-mono text-[var(--status-verified)] mt-1">₹1,50,000 PMLA Trigger</div>
        </div>
      </div>

      {/* ── Filter Controls ── */}
      <div className="px-6 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search size={12} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by holder name, masked account (XXXX7788), bank..."
              className="workstation-input pl-8 pr-3 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded px-2.5 py-1">
            <Filter size={12} className="text-[var(--text-muted)]" />
            <select
              value={minAmount}
              onChange={(e) => setMinAmount(Number(e.target.value))}
              className="bg-transparent text-xs text-[var(--text-secondary)] outline-none cursor-pointer"
            >
              <option value={0} className="bg-[var(--bg-panel-solid)]">All Amounts</option>
              <option value={50000} className="bg-[var(--bg-panel-solid)]">Above ₹50,000</option>
              <option value={150000} className="bg-[var(--bg-panel-solid)]">Above ₹1,50,000 (Priority)</option>
              <option value={500000} className="bg-[var(--bg-panel-solid)]">Above ₹5,00,000 (Critical)</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] font-mono text-[var(--text-muted)]">
          {transactions.length} Ledger Records
        </div>
      </div>

      {/* ── Table Feed ── */}
      <div className="flex-1 p-6 overflow-y-auto space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-16 rounded-lg" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="panel p-12 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-panel-solid)]">
            <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
            <div className="font-semibold text-[var(--text-secondary)] uppercase">No transactions matched</div>
            <p className="mt-1 text-[11px]">No financial transfers met the filtering criteria.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((txn) => (
              <div
                key={txn.id}
                className={`panel p-3.5 bg-[var(--bg-panel-solid)] hover:border-[var(--border-strong)] transition-all ${
                  txn.flagged ? "border-l-2 border-l-[var(--status-warning)]" : ""
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Originating Account & Sender */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded flex items-center justify-center bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] text-[var(--status-purple)] shrink-0">
                      <Building2 size={15} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-w-0">
                      {/* Debited Party */}
                      <div>
                        <div className="text-[10px] font-mono uppercase text-[var(--text-muted)]">
                          Remitter / Source Account
                        </div>
                        <div
                          onClick={() => txn.sender_name && navigate(`/entities?q=${encodeURIComponent(txn.sender_name)}`)}
                          className="text-xs font-bold text-[var(--text-primary)] hover:text-[var(--intel-sky)] cursor-pointer truncate"
                        >
                          {txn.sender_name}
                        </div>
                        <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                          {txn.sender_bank} • {txn.sender_account}
                        </div>
                      </div>

                      {/* Credited Party */}
                      <div>
                        <div className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
                          <ArrowRight size={10} />
                          <span>Beneficiary / Destination</span>
                        </div>
                        <div
                          onClick={() => txn.receiver_name && navigate(`/entities?q=${encodeURIComponent(txn.receiver_name)}`)}
                          className="text-xs font-bold text-[var(--text-primary)] hover:text-[var(--intel-sky)] cursor-pointer truncate"
                        >
                          {txn.receiver_name}
                        </div>
                        <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                          {txn.receiver_bank} • {txn.receiver_account}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Amount & Time */}
                  <div className="flex items-center gap-5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--border-subtle)]">
                    <div className="text-right">
                      <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Amount (INR)</div>
                      <div className="text-sm font-mono font-bold text-[var(--text-bright)]">
                        ₹{txn.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="text-right min-w-[130px]">
                      <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Settlement Date</div>
                      <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                        {new Date(txn.timestamp).toLocaleDateString()} {new Date(txn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {txn.flagged && (
                        <span className="badge badge-medium text-[9px]">SUSPICIOUS SURGE</span>
                      )}
                      <span className="badge badge-low text-[9px]">{txn.status}</span>
                    </div>
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
