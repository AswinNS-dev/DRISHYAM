import { create } from "zustand";

export type UserInfo = { id: string; email: string; full_name: string; role: string };

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const STORAGE_TOKEN_KEY = "drishyam_token";
const STORAGE_USER_KEY = "drishyam_user";
const STORAGE_ACTIVITY_KEY = "drishyam_last_activity";

type AuthState = {
  token: string | null;
  user: UserInfo | null;
  sessionExpiredMessage: string | null;
  login: (token: string, user: UserInfo) => void;
  logout: (expiredReason?: string) => void;
  clearExpiredMessage: () => void;
  recordActivity: () => void;
  checkSessionValidity: () => boolean;
};

function getInitialToken(): string | null {
  const token = localStorage.getItem(STORAGE_TOKEN_KEY);
  if (!token) return null;
  const lastActive = parseInt(localStorage.getItem(STORAGE_ACTIVITY_KEY) || "0", 10);
  if (lastActive && Date.now() - lastActive > INACTIVITY_TIMEOUT_MS) {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_ACTIVITY_KEY);
    return null;
  }
  return token;
}

function getInitialUser(): UserInfo | null {
  const token = getInitialToken();
  if (!token) return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_USER_KEY) || "null");
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  token: getInitialToken(),
  user: getInitialUser(),
  sessionExpiredMessage: (() => {
    const rawToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    const lastActive = parseInt(localStorage.getItem(STORAGE_ACTIVITY_KEY) || "0", 10);
    if (rawToken && lastActive && Date.now() - lastActive > INACTIVITY_TIMEOUT_MS) {
      return "Your session has expired. Please sign in again.";
    }
    return null;
  })(),

  login: (token, user) => {
    const now = Date.now();
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    localStorage.setItem(STORAGE_ACTIVITY_KEY, now.toString());
    set({ token, user, sessionExpiredMessage: null });
  },

  logout: (expiredReason) => {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_ACTIVITY_KEY);
    set({
      token: null,
      user: null,
      sessionExpiredMessage: expiredReason || null,
    });
  },

  clearExpiredMessage: () => {
    set({ sessionExpiredMessage: null });
  },

  recordActivity: () => {
    if (get().token) {
      const now = Date.now();
      localStorage.setItem(STORAGE_ACTIVITY_KEY, now.toString());
    }
  },

  checkSessionValidity: () => {
    const token = get().token;
    if (!token) return false;
    const lastActive = parseInt(localStorage.getItem(STORAGE_ACTIVITY_KEY) || "0", 10);
    if (lastActive && Date.now() - lastActive > INACTIVITY_TIMEOUT_MS) {
      get().logout("Your session has expired. Please sign in again.");
      return false;
    }
    return true;
  },
}));

// Setup global user activity listeners & inactivity watchdog
if (typeof window !== "undefined") {
  let throttleTimer: any = null;
  const updateActivity = () => {
    if (!throttleTimer) {
      throttleTimer = setTimeout(() => {
        useAuth.getState().recordActivity();
        throttleTimer = null;
      }, 3000); // Throttled to max once per 3s
    }
  };

  window.addEventListener("mousemove", updateActivity, { passive: true });
  window.addEventListener("keydown", updateActivity, { passive: true });
  window.addEventListener("click", updateActivity, { passive: true });
  window.addEventListener("scroll", updateActivity, { passive: true });
  window.addEventListener("touchstart", updateActivity, { passive: true });

  // Watchdog ticker checking every 15 seconds
  setInterval(() => {
    const state = useAuth.getState();
    if (state.token) {
      const valid = state.checkSessionValidity();
      if (!valid && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
  }, 15000);
}
