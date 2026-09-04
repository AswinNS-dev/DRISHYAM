import { create } from "zustand";

export type UserInfo = { id: string; email: string; full_name: string; role: string };

type AuthState = {
  token: string | null;
  user: UserInfo | null;
  login: (token: string, user: UserInfo) => void;
  logout: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem("drishyam_token"),
  user: JSON.parse(localStorage.getItem("drishyam_user") || "null"),
  login: (token, user) => {
    localStorage.setItem("drishyam_token", token);
    localStorage.setItem("drishyam_user", JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem("drishyam_token");
    localStorage.removeItem("drishyam_user");
    set({ token: null, user: null });
  },
}));
