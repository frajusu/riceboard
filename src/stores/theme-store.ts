import { create } from "zustand";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "dark";
}

function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: (theme) => {
    const resolved = theme === "system" ? getSystemTheme() : theme;
    applyTheme(resolved);
    set({ theme, resolvedTheme: resolved });
  },
}));

if (typeof window !== "undefined") {
  applyTheme("dark");
}
