import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

const DEMO_ACCOUNTS = [
  { email: "investigator@drishyam.demo", role: "Investigator" },
  { email: "analyst@drishyam.demo", role: "Crime Analyst" },
  { email: "admin@drishyam.demo", role: "Admin" },
];

export default function Login() {
  const [email, setEmail] = useState("investigator@drishyam.demo");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuth((s) => s.login);
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
      setError("Login failed. Check the backend is running and credentials are correct.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-void)" }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Eye size={26} color="var(--accent-teal)" />
          <div className="text-xl font-bold tracking-wide">DRISHYAM</div>
        </div>
        <form onSubmit={handleSubmit} className="panel p-6 space-y-4">
          <div>
            <label className="text-xs text-[var(--text-secondary)]">Email</label>
            <input
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent-teal)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)]">Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full bg-[var(--bg-panel-raised)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent-teal)]"
            />
          </div>
          {error && <div className="text-xs text-[var(--accent-red)]">{error}</div>}
          <button
            disabled={loading}
            className="w-full py-2 rounded-lg text-sm font-semibold bg-[var(--accent-teal)] text-[#08211d] disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-4 panel p-4">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-2">
            <ShieldCheck size={14} /> Demo accounts (password: demo1234)
          </div>
          <div className="space-y-1">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                onClick={() => { setEmail(a.email); setPassword("demo1234"); }}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-[var(--bg-panel-raised)] flex justify-between"
              >
                <span className="mono text-[var(--text-secondary)]">{a.email}</span>
                <span className="text-[var(--text-muted)]">{a.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
