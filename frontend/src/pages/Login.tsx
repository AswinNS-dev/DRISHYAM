import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { Eye, Shield, AlertTriangle } from "lucide-react";
import ParticleNetwork from "../components/ParticleNetwork";

const DEMO_ACCOUNTS = [
  { label: "Investigator", email: "investigator@drishyam.demo", icon: "🔍" },
  { label: "Admin", email: "admin@drishyam.demo", icon: "⚡" },
  { label: "Analyst", email: "analyst@drishyam.demo", icon: "📊" },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(email, password);
      login(res.access_token, res.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError("Authentication failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  }

  function quickSelect(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("demo1234");
  }

  return (
    <div className="relative w-full h-screen flex items-center justify-center overflow-hidden"
         style={{ background: "var(--bg-void)" }}>
      {/* Particle network background */}
      <ParticleNetwork />

      {/* Radial gradient overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 50% 50%, transparent 0%, var(--bg-void) 70%)",
        pointerEvents: "none",
      }} />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-4">
        <form onSubmit={handleSubmit}
          className="glass-panel p-8 relative overflow-hidden"
          style={{ borderColor: "rgba(45, 212, 191, 0.15)" }}
        >
          {/* Scanline effect */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px)",
          }} />

          {/* Corner brackets */}
          <div style={{ position: "absolute", top: 8, left: 8, width: 16, height: 16,
            borderTop: "2px solid var(--neon-teal)", borderLeft: "2px solid var(--neon-teal)", opacity: 0.4 }} />
          <div style={{ position: "absolute", top: 8, right: 8, width: 16, height: 16,
            borderTop: "2px solid var(--neon-teal)", borderRight: "2px solid var(--neon-teal)", opacity: 0.4 }} />
          <div style={{ position: "absolute", bottom: 8, left: 8, width: 16, height: 16,
            borderBottom: "2px solid var(--neon-teal)", borderLeft: "2px solid var(--neon-teal)", opacity: 0.4 }} />
          <div style={{ position: "absolute", bottom: 8, right: 8, width: 16, height: 16,
            borderBottom: "2px solid var(--neon-teal)", borderRight: "2px solid var(--neon-teal)", opacity: 0.4 }} />

          {/* Logo */}
          <div className="flex flex-col items-center mb-8 relative">
            <div
              className="flex items-center justify-center mb-4"
              style={{
                width: 56, height: 56, borderRadius: 14,
                background: "linear-gradient(135deg, rgba(45,212,191,0.12), rgba(0,255,255,0.06))",
                border: "1px solid rgba(45,212,191,0.3)",
                boxShadow: "0 0 30px rgba(0,255,255,0.12)",
              }}
            >
              <Eye size={26} color="var(--neon-teal)"
                style={{ filter: "drop-shadow(0 0 8px rgba(0,255,255,0.5))" }} />
            </div>
            <h1 className="text-xl font-bold tracking-widest"
                style={{ color: "var(--neon-teal)", textShadow: "0 0 20px rgba(45,212,191,0.3)" }}>
              DRISHYAM
            </h1>
            <p className="hud-label mt-1" style={{ fontSize: 9, color: "var(--text-muted)" }}>
              AI-Powered Criminal Network Intelligence
            </p>
          </div>

          {/* HUD status indicators */}
          <div className="flex justify-center gap-6 mb-6">
            {[
              { label: "NETWORK", status: "ONLINE" },
              { label: "AI ENGINE", status: "READY" },
              { label: "DATABASE", status: "ACTIVE" },
            ].map(({ label, status }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="glow-dot glow-dot-teal" style={{ width: 5, height: 5 }} />
                <span className="hud-label" style={{ fontSize: 8 }}>{label}: {status}</span>
              </div>
            ))}
          </div>

          {/* System access label */}
          <div className="flex items-center gap-2 mb-5">
            <Shield size={12} color="var(--text-muted)" />
            <span className="hud-label" style={{ fontSize: 9 }}>System Access</span>
            <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
          </div>

          {/* Demo account quick-select */}
          <div className="flex gap-2 mb-5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => quickSelect(acc.email)}
                className="flex-1 py-2.5 rounded-lg text-center transition-all"
                style={{
                  background: email === acc.email ? "rgba(45,212,191,0.1)" : "var(--bg-input)",
                  border: email === acc.email
                    ? "1px solid rgba(45,212,191,0.35)"
                    : "1px solid var(--border-input)",
                  boxShadow: email === acc.email ? "0 0 12px rgba(0,255,255,0.08)" : "none",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 16 }}>{acc.icon}</div>
                <div className="hud-label mt-1" style={{
                  fontSize: 9,
                  color: email === acc.email ? "var(--neon-teal)" : "var(--text-muted)",
                }}>
                  {acc.label}
                </div>
              </button>
            ))}
          </div>

          {/* Inputs */}
          <div className="space-y-3 mb-5">
            <div>
              <label className="hud-label block mb-1.5" style={{ fontSize: 9 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@drishyam.demo"
                className="input-cyber"
                required
              />
            </div>
            <div>
              <label className="hud-label block mb-1.5" style={{ fontSize: 9 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-cyber"
                required
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg"
                 style={{ background: "rgba(255,59,92,0.08)", border: "1px solid rgba(255,59,92,0.2)" }}>
              <AlertTriangle size={14} color="var(--neon-red)" />
              <span className="text-xs" style={{ color: "var(--neon-red)" }}>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email}
            className="btn-primary w-full"
            style={{ padding: "12px 24px" }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="pulse-dot">●</span> AUTHENTICATING...
              </span>
            ) : (
              "INITIALIZE SESSION"
            )}
          </button>

          {/* Footer */}
          <div className="text-center mt-5">
            <span className="hud-label" style={{ fontSize: 8, color: "var(--text-muted)" }}>
              SIH26189 · MINISTRY OF HOME AFFAIRS · DEMO BUILD
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
