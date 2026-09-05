import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { useTheme } from "../store/theme";
import { Eye, EyeOff, Shield, AlertTriangle, Lock, Mail, ArrowRight, Sun, Moon } from "lucide-react";
import ParticleNetwork from "../components/ParticleNetwork";

const DEMO_ACCOUNTS = [
  { role: "Investigator", email: "investigator@drishyam.demo", label: "Lead Investigator", badge: "BADGE #8821", icon: "🔍" },
  { role: "Analyst", email: "analyst@drishyam.demo", label: "Intelligence Analyst", badge: "UNIT #04", icon: "📊" },
  { role: "Admin", email: "admin@drishyam.demo", label: "System Administrator", badge: "ROOT ACCESS", icon: "⚡" },
];

export default function Login() {
  const [email, setEmail] = useState("investigator@drishyam.demo");
  const [password, setPassword] = useState("demo1234");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, sessionExpiredMessage, clearExpiredMessage } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    clearExpiredMessage();
    setLoading(true);
    try {
      const res = await api.login(email, password);
      login(res.access_token, res.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError("Authentication failed. Invalid clearance or credentials.");
    } finally {
      setLoading(false);
    }
  }

  function quickSelect(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("demo1234");
    setError("");
    clearExpiredMessage();
  }

  return (
    <div className="relative w-full h-screen flex items-center justify-center overflow-hidden"
         style={{ background: "var(--bg-void)" }}>
      {/* Theme Toggle in top right */}
      <div className="absolute top-5 right-5 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] hover:border-[var(--neon-teal)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-lg"
        >
          {theme === "dark" ? (
            <>
              <Sun size={14} className="text-[var(--neon-amber)]" />
              <span className="font-mono text-[11px]">Light Mode</span>
            </>
          ) : (
            <>
              <Moon size={14} className="text-[var(--neon-teal)]" />
              <span className="font-mono text-[11px]">Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Dynamic interactive particle network background */}
      <ParticleNetwork />

      {/* Radial vignette glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 50% 50%, transparent 10%, rgba(6, 9, 15, 0.85) 80%)",
        pointerEvents: "none",
      }} />

      {/* Centered Login Card */}
      <div className="relative z-10 w-full max-w-lg px-4">
        <form onSubmit={handleSubmit}
          className="glass-panel p-8 relative overflow-hidden"
          style={{
            borderColor: "rgba(45, 212, 191, 0.25)",
            boxShadow: "0 20px 80px rgba(0,0,0,0.8), 0 0 40px rgba(45,212,191,0.08)",
            borderRadius: 16
          }}
        >
          {/* Cyber scanline texture */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
          }} />

          {/* Tactical Corner brackets */}
          <div style={{ position: "absolute", top: 10, left: 10, width: 14, height: 14,
            borderTop: "2px solid var(--neon-teal)", borderLeft: "2px solid var(--neon-teal)", opacity: 0.7 }} />
          <div style={{ position: "absolute", top: 10, right: 10, width: 14, height: 14,
            borderTop: "2px solid var(--neon-teal)", borderRight: "2px solid var(--neon-teal)", opacity: 0.7 }} />
          <div style={{ position: "absolute", bottom: 10, left: 10, width: 14, height: 14,
            borderBottom: "2px solid var(--neon-teal)", borderLeft: "2px solid var(--neon-teal)", opacity: 0.7 }} />
          <div style={{ position: "absolute", bottom: 10, right: 10, width: 14, height: 14,
            borderBottom: "2px solid var(--neon-teal)", borderRight: "2px solid var(--neon-teal)", opacity: 0.7 }} />

          {/* DRISHYAM Brand Header */}
          <div className="flex flex-col items-center mb-6 relative">
            <div
              className="flex items-center justify-center mb-3"
              style={{
                width: 58, height: 58, borderRadius: 16,
                background: "linear-gradient(135deg, rgba(45,212,191,0.2), rgba(0,255,255,0.08))",
                border: "1px solid rgba(45,212,191,0.4)",
                boxShadow: "0 0 32px rgba(0,255,255,0.2)",
              }}
            >
              <Eye size={28} color="var(--neon-teal)"
                style={{ filter: "drop-shadow(0 0 8px rgba(0,255,255,0.7))" }} />
            </div>
            <h1 className="text-2xl font-black tracking-widest text-center"
                style={{ color: "var(--neon-teal)", textShadow: "0 0 20px rgba(45,212,191,0.4)" }}>
              DRISHYAM
            </h1>
            <p className="hud-label mt-1 text-center" style={{ fontSize: 9, color: "var(--text-secondary)", letterSpacing: "0.14em" }}>
              SIH26189 · AI CRIMINAL NETWORK INTELLIGENCE TERMINAL
            </p>
          </div>

          {/* Three-up provider/role authentication row */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="hud-label text-[9px] text-[var(--text-muted)]">QUICK CREDENTIAL PRESETS</span>
              <span className="text-[9px] font-mono text-[var(--neon-teal)]">AUTHORIZED ACCESS</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const active = email === acc.email;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => quickSelect(acc.email)}
                    className="p-2.5 rounded-xl text-left transition-all relative overflow-hidden"
                    style={{
                      background: active ? "rgba(45,212,191,0.12)" : "var(--bg-panel-raised)",
                      border: active ? "1px solid var(--neon-teal)" : "1px solid var(--border-subtle)",
                      boxShadow: active ? "0 0 16px rgba(45,212,191,0.15)" : "none",
                      cursor: "pointer",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{acc.icon}</span>
                      <span className={`badge ${active ? "badge-low" : "badge-demo"}`} style={{ fontSize: 7, padding: "1px 4px" }}>
                        {acc.role}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-[var(--text-primary)] truncate">{acc.label}</div>
                    <div className="text-[8px] font-mono text-[var(--text-muted)] mt-0.5">{acc.badge}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Inputs */}
          <div className="space-y-4 mb-4">
            <div>
              <label className="hud-label block mb-1.5 text-[9px] flex items-center justify-between">
                <span>OFFICER IDENTITY / EMAIL</span>
                <span className="font-mono text-[var(--text-muted)]">SECURE DOMAIN</span>
              </label>
              <div className="relative flex items-center">
                <Mail size={16} className="absolute left-3.5 text-[var(--neon-teal)] opacity-80 pointer-events-none z-10" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@drishyam.demo"
                  className="input-cyber input-cyber-icon-left text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="hud-label block mb-1.5 text-[9px] flex items-center justify-between">
                <span>SECURITY CLEARANCE PIN</span>
                <span className="font-mono text-[var(--text-muted)]">AES-256</span>
              </label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3.5 text-[var(--neon-teal)] opacity-80 pointer-events-none z-10" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-cyber input-cyber-icon-left input-cyber-icon-right text-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-[var(--text-muted)] hover:text-[var(--neon-teal)] transition-colors p-1 z-10 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Keep me signed in toggle switch & Forgot */}
          <div className="flex items-center justify-between mb-5 pt-1">
            <label className="cyber-switch">
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
              />
              <span className="cyber-switch-slider" />
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">Keep terminal session active</span>
            </label>

            <span className="text-[10px] font-mono text-[var(--neon-teal)] opacity-80 hover:opacity-100 cursor-pointer">
              Forgot PIN?
            </span>
          </div>

          {/* Session Inactivity Expired Alert Banner */}
          {sessionExpiredMessage && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.4)] text-[var(--neon-amber)] text-xs">
              <AlertTriangle size={15} className="shrink-0 text-[var(--neon-amber)]" />
              <div className="flex-1 font-medium">{sessionExpiredMessage}</div>
              <button
                type="button"
                onClick={clearExpiredMessage}
                className="text-[10px] font-mono opacity-70 hover:opacity-100 uppercase"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-[rgba(255,59,92,0.1)] border border-[rgba(255,59,92,0.3)] text-[var(--neon-red)] text-xs animate-shake">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !email}
            className="btn-primary w-full py-3 text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(45,212,191,0.2)] hover:shadow-[0_0_30px_rgba(45,212,191,0.4)]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-[#08211d] border-t-transparent animate-spin" />
                VERIFYING ENCRYPTED CLEARANCE...
              </span>
            ) : (
              <>
                <span>INITIALIZE INVESTIGATION WORKSPACE</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>

          {/* Security Classification Footer */}
          <div className="text-center mt-5 pt-4 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-center gap-2 text-[9px] font-mono text-[var(--text-muted)]">
              <Shield size={11} className="text-[var(--neon-teal)]" />
              <span>OFFICIAL USE ONLY · SIH26189 · EVIDENCE STANDARDS RETAINED</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
