import { create } from "zustand";

type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useTheme = create<ThemeState>((set) => {
  const savedTheme = (localStorage.getItem("drishyam_theme") as Theme) || "dark";
  
  // Apply theme to document element immediately
  if (typeof document !== "undefined") {
    if (savedTheme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
  }

  return {
    theme: savedTheme,
    toggleTheme: () =>
      set((state) => {
        const nextTheme = state.theme === "dark" ? "light" : "dark";
        localStorage.setItem("drishyam_theme", nextTheme);
        if (typeof document !== "undefined") {
          if (nextTheme === "light") {
            document.documentElement.classList.add("light");
            document.documentElement.classList.remove("dark");
          } else {
            document.documentElement.classList.add("dark");
            document.documentElement.classList.remove("light");
          }
        }
        return { theme: nextTheme };
      }),
    setTheme: (theme: Theme) => {
      localStorage.setItem("drishyam_theme", theme);
      if (typeof document !== "undefined") {
        if (theme === "light") {
          document.documentElement.classList.add("light");
          document.documentElement.classList.remove("dark");
        } else {
          document.documentElement.classList.add("dark");
          document.documentElement.classList.remove("light");
        }
      }
      set({ theme });
    },
  };
});
