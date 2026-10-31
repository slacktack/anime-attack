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

export type ThemeId = "midnight" | "obsidian" | "neon" | "sakura" | "paper";

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  primary: string;
}

export const THEMES: ThemeDefinition[] = [
  { id: "midnight", label: "Midnight", primary: "#ff3d5f" },
  { id: "obsidian", label: "Obsidian", primary: "#2dd4bf" },
  { id: "neon", label: "Neon", primary: "#e879f9" },
  { id: "sakura", label: "Sakura", primary: "#ec4899" },
  { id: "paper", label: "Paper", primary: "#d6203f" },
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

function systemTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "paper"
    : DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const next = isThemeId(stored) ? stored : systemTheme();
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
