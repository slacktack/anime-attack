"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeId =
  | "midnight"
  | "neobrutalist"
  | "sakura"
  | "cyber"
  | "gold"
  | "mono";

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  primary: string;
}

export const THEMES: ThemeDefinition[] = [
  { id: "midnight", label: "Midnight", primary: "#7C3AED" },
  { id: "neobrutalist", label: "Neobrutalist", primary: "#8B5CF6" },
  { id: "sakura", label: "Sakura", primary: "#F472B6" },
  { id: "cyber", label: "Cyber", primary: "#22D3EE" },
  { id: "gold", label: "Gold", primary: "#F5C518" },
  { id: "mono", label: "Mono", primary: "#E5E5E5" },
];

const STORAGE_KEY = "ac.theme";
const DEFAULT_THEME: ThemeId = "midnight";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  themes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isThemeId(value: string | null): value is ThemeId {
  return !!value && THEMES.some((t) => t.id === value);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const next = isThemeId(stored) ? stored : DEFAULT_THEME;
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.setAttribute("data-theme", next);
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, themes: THEMES }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
