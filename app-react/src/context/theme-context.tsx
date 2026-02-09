import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as storage from "@/services/storage.ts";
import type { Settings } from "@/types/index.ts";

interface ThemeContextValue {
  isDark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialDarkMode(): boolean {
  const raw = storage.load<Settings | null>("settings", null);
  if (raw && typeof raw.darkMode === "boolean") return raw.darkMode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getSettings(): Settings {
  return storage.load<Settings>("settings", { darkMode: false, dailyGoal: 20 });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(getInitialDarkMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      const settings = getSettings();
      settings.darkMode = next;
      storage.save("settings", settings);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
