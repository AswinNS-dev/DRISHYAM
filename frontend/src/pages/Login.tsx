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
    <div className="min-h-screen w-full flex items-center justify-center p-6 lg:p-12 bg-black select-none">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* ── Left Side: Prominent & Eye-Catching RBAC Clearance Showcase ── */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono tracking-wider uppercase text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Role-Based Access Control (RBAC)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Law-Enforcement Clearance Tiers
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-xl">
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
                      ? "bg-[#121215] border-zinc-400 shadow-2xl ring-1 ring-zinc-500/50"
                      : "bg-[#0c0c0e] border-zinc-800/80 hover:border-zinc-700 hover:bg-[#101013]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected
                          ? "bg-white text-black border-white"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 group-hover:text-zinc-200"
                      }`}>
                        <Icon size={18} />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-white tracking-tight">
                            {tier.title}
                          </h3>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
                            {tier.clearanceLevel}
                          </span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                            isSelected
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-zinc-900 text-zinc-500"
                          }`}>
                            {tier.badge}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-400 leading-normal">
                          {tier.summary}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {tier.features.map((f, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-mono"
                            >
                              <CheckCircle2 size={10} className={isSelected ? "text-emerald-400" : "text-zinc-600"} />
                              <span>{f}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 pt-0.5">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                        isSelected
                          ? "border-white bg-white text-black"
                          : "border-zinc-700 bg-transparent"
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-black" />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-xs text-zinc-500 pt-2">
            <span>Official Police Department Clearance</span>
            <span>•</span>
            <span>Zero-Trust Cryptographic Audit</span>
          </div>
        </div>

        {/* ── Right Side: Sleek Sign-In Card (Exact Theme Alignment) ── */}
        <div className="lg:col-span-5 w-full max-w-[420px] mx-auto">
          <div className="bg-[#0c0c0e] border border-zinc-800/80 rounded-2xl p-7 sm:p-8 shadow-2xl space-y-6">
            {/* Header with Department Icon */}
            <div className="text-center space-y-2">
              <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-bold text-xs flex items-center justify-center mx-auto shadow-sm">
                CI
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-white">
                  Sign in
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Access the CrimeIntel investigation suite
                </p>
              </div>
            </div>

            {/* Active Clearance Badge Notification */}
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Target Clearance:</span>
              <span className="font-semibold text-white font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {selectedTier.title}
              </span>
            </div>

            {/* Error / Expiration notices */}
            {sessionExpiredMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{sessionExpiredMessage}</span>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Department Email or Officer ID
                </label>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@police.gov.in"
                  className="w-full h-10 px-3.5 rounded-lg bg-[#08080a] border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-300">
                    Security Passcode
                  </label>
                  <button
                    type="button"
                    onClick={() => alert("Contact Station Administrator or Cyber Cell to reset cryptographic tokens.")}
                    className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
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
                    className="w-full h-10 pl-3.5 pr-10 rounded-lg bg-[#08080a] border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
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
                    className="w-4 h-4 rounded border-zinc-700 bg-[#08080a] text-white focus:ring-0 focus:ring-offset-0 cursor-pointer accent-white"
                  />
                  <span className="text-xs text-zinc-400">Keep me signed in for 30 days</span>
                </label>
              </div>

              {/* Stark White Submit Action */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{loading ? "Verifying Clearance..." : "Authorize & Enter Workstation"}</span>
                <ArrowRight size={14} />
              </button>
            </form>

            {/* Legal / Security Footer */}
            <div className="pt-2 text-center text-[10px] text-zinc-500 leading-relaxed font-mono">
              Authorized personnel only. All access attempts are cryptographically timestamped and signed.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
