"use client";

import { useState } from "react";
import { Palette, Check } from "lucide-react";
import { useTheme } from "@/components/ui/ThemeProvider";

export function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-4 bottom-24 z-[55]">
      {open ? (
        <div
          role="menu"
          aria-label="Choose theme"
          className="absolute bottom-[calc(100%+0.75rem)] right-0 w-52 rounded-2xl border border-white/10 bg-ink-800/90 p-2 backdrop-blur-xl shadow-2xl"
        >
          {themes.map((t) => {
            const active = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
                className="flex w-full min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-white/90 transition-colors hover:bg-white/10"
              >
                <span
                  className="h-4 w-4 flex-none rounded-full border border-white/20"
                  style={{ backgroundColor: t.primary }}
                  aria-hidden="true"
                />
                <span className="flex-1">{t.label}</span>
                {active ? <Check className="h-4 w-4 flex-none text-white/80" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Change theme"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-ink-800/80 text-white backdrop-blur-xl shadow-lg transition-transform active:scale-95"
      >
        <Palette className="h-5 w-5" />
      </button>
    </div>
  );
}
