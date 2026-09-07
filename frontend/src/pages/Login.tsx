import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import {
  Eye, EyeOff, AlertTriangle, ShieldCheck,
  Brain, Sliders, CheckCircle2, ArrowRight
} from "lucide-react";

interface RbacTier {
  role: string;
  title: string;
  badge: string;
  clearanceLevel: string;
  email: string;
  summary: string;
  features: string[];
  icon: typeof ShieldCheck;
}

const RBAC_TIERS: RbacTier[] = [
  {
    role: "investigator",
    title: "Lead Investigator",
    badge: "OPERATIONAL",
    clearanceLevel: "SEC-LEVEL 4",
    email: "investigator@drishyam.demo",
    summary: "Case workspaces, FIR complaints, seized physical exhibits, and subject profiles.",
    features: ["FIR Statement Registry", "Evidence Chain of Custody", "Warrant & Case Worklists"],
    icon: ShieldCheck,
  },
  {
    role: "analyst",
    title: "Crime Analyst",
    badge: "ANALYTICS",
    clearanceLevel: "SEC-LEVEL 3",
    email: "analyst@drishyam.demo",
    summary: "Graph association analysis, centrality scoring, temporal timelines, and AI suggestions.",
    features: ["Network Link Analysis", "PageRank Key Influencers", "Chronology Event Reconstruction"],
    icon: Brain,
  },
  {
    role: "admin",
    title: "System Administrator",
    badge: "GOVERNANCE",
    clearanceLevel: "SEC-LEVEL 5",
    email: "admin@drishyam.demo",
    summary: "System audit trails, officer RBAC provisioning, and AI calibration parameters.",
    features: ["Officer Access Control", "Cryptographic Audit Ledger", "Model Inference Calibration"],
    icon: Sliders,
  },
];

export default function Login() {
  const [email, setEmail] = useState("investigator@drishyam.demo");
  const [password, setPassword] = useState("demo1234");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, sessionExpiredMessage, clearExpiredMessage } = useAuth();
  const navigate = useNavigate();

  const selectedTier = RBAC_TIERS.find((t) => t.email === email) || RBAC_TIERS[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    clearExpiredMessage();
    setLoading(true);
    try {
      const res = await api.login(email, password);
      if (keepSignedIn) {
        localStorage.setItem("drishyam_keep_signed_in", "true");
      }
      login(res.access_token, res.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError("Clearance authorization failed. Invalid security credentials.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectTier(tier: RbacTier) {
    setEmail(tier.email);
    setPassword("demo1234");
    setError("");
    clearExpiredMessage();
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 lg:p-12 bg-[#020617] text-slate-100 select-none">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* ── Left Side: Prominent & Eye-Catching RBAC Clearance Showcase ── */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[10px] font-mono tracking-wider uppercase text-sky-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Role-Based Access Control (RBAC) Governance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase text-glow-white">
              Law-Enforcement Clearance Tiers
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl">
              Select an authorized clearance level below to inspect role-restricted permissions, sensitive case intelligence, and chain-of-custody controls.
            </p>
          </div>

          {/* Large, Rich RBAC Cards */}
          <div className="space-y-3">
            {RBAC_TIERS.map((tier) => {
              const isSelected = email === tier.email;
              const Icon = tier.icon;
              return (
                <div
                  key={tier.role}
                  onClick={() => handleSelectTier(tier)}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                    isSelected
                      ? "bg-sky-950/30 border-sky-500/60 shadow-xl shadow-sky-950/40 ring-1 ring-sky-500/40"
                      : "bg-slate-900/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected
                          ? "bg-sky-500 text-slate-950 border-sky-400"
                          : "bg-slate-950 text-slate-400 border-slate-800 group-hover:text-slate-200"
                      }`}>
                        <Icon size={18} />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`text-sm font-bold tracking-tight ${isSelected ? "text-white text-glow-white" : "text-slate-200"}`}>
                            {tier.title}
                          </h3>
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 font-bold">
                            {tier.clearanceLevel}
                          </span>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            isSelected
                              ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
                              : "bg-slate-950 text-slate-500 border border-slate-800"
                          }`}>
                            {tier.badge}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 leading-normal">
                          {tier.summary}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {tier.features.map((f, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-mono"
                            >
                              <CheckCircle2 size={11} className={isSelected ? "text-emerald-400" : "text-slate-600"} />
                              <span>{f}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 pt-0.5">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected
                          ? "border-sky-400 bg-sky-500 text-slate-950"
                          : "border-slate-700 bg-transparent"
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-slate-950" />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 font-mono">
            <span>Official Police Department Clearance</span>
            <span>•</span>
            <span>Zero-Trust Cryptographic Audit</span>
          </div>
        </div>

        {/* ── Right Side: Sleek Sign-In Card (Exact Theme Alignment) ── */}
        <div className="lg:col-span-5 w-full max-w-[420px] mx-auto">
          <div className="bg-slate-900/95 border border-slate-800/90 rounded-2xl p-7 sm:p-8 shadow-2xl space-y-6 backdrop-blur-md">
            {/* Header with Department Icon */}
            <div className="text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-sky-950/50 border border-sky-500/40 text-sky-400 font-black text-xs flex items-center justify-center mx-auto">
                CI
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white uppercase text-glow-white">
                  Officer Sign In
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Access the CrimeIntel AI Investigation Suite
                </p>
              </div>
            </div>

            {/* Active Clearance Badge Notification */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Target Clearance:</span>
              <span className="font-semibold text-white font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {selectedTier.title}
              </span>
            </div>

            {/* Error / Expiration notices */}
            {sessionExpiredMessage && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0 text-rose-400" />
                <span>{sessionExpiredMessage}</span>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Department Email or Officer ID
                </label>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@police.gov.in"
                  className="w-full h-10 px-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Security Passcode
                  </label>
                  <button
                    type="button"
                    onClick={() => alert("Contact Station Administrator or Cyber Cell to reset cryptographic tokens.")}
                    className="text-xs text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                  >
                    Forgot passcode?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 pl-3.5 pr-10 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Keep me signed in */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-sky-500"
                  />
                  <span className="text-xs text-slate-400">Keep me signed in for 30 days</span>
                </label>
              </div>

              {/* Tactical Sky Submit Action */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-lg shadow-sky-950/50 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
              >
                <span>{loading ? "Verifying Clearance..." : "Authorize & Enter Workstation"}</span>
                <ArrowRight size={14} />
              </button>
            </form>

            {/* Legal / Security Footer */}
            <div className="pt-2 text-center text-[10px] text-slate-500 leading-relaxed font-mono">
              Authorized personnel only. All access attempts are cryptographically timestamped and signed.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
