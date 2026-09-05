import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useEffect } from "react";

interface RequireAuthProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const { token, user, checkSessionValidity } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      checkSessionValidity();
    }
  }, [token, checkSessionValidity]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user) {
    const userRole = (user.role || "").toLowerCase();
    const hasRole = allowedRoles.some((r) => r.toLowerCase() === userRole);

    if (!hasRole) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-[var(--bg-void)] text-center">
          <div className="glass-panel p-8 max-w-md w-full border border-[rgba(255,59,92,0.3)] shadow-[0_0_50px_rgba(255,59,92,0.15)] rounded-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-[rgba(255,59,92,0.12)] text-[var(--neon-red)] border border-[rgba(255,59,92,0.3)]">
              <ShieldAlert size={32} />
            </div>
            <div className="hud-label text-[10px] text-[var(--neon-red)] tracking-widest mb-1">
              SECURITY ACCESS RESTRICTED · 403 FORBIDDEN
            </div>
            <h2 className="text-lg font-black text-[var(--text-primary)] mb-2">
              Insufficient Security Clearance
            </h2>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-6">
              Your registered credential tier (<span className="font-mono font-bold uppercase text-[var(--neon-teal)]">{user.role}</span>) does not possess clearance for this operational section. This action has been recorded in the central audit ledger.
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => navigate("/dashboard")}
                className="btn-primary py-2.5 px-6 text-xs font-bold uppercase flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                <span>Return to Command Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
