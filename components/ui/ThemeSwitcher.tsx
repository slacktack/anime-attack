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
          className="nb-card absolute bottom-[calc(100%+0.75rem)] right-0 w-52 bg-ink-800 p-2"
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
                className={active ? "nb-btn nb-btn-accent w-full min-h-11 justify-start rounded-xl" : "nb-btn w-full min-h-11 justify-start rounded-xl"}
              >
                <span
                  className="h-4 w-4 flex-none rounded-sm border-2 border-nb-border"
                  style={{ backgroundColor: t.primary }}
                  aria-hidden="true"
                />
                <span className="flex-1">{t.label}</span>
                {active ? <Check className="h-4 w-4 flex-none" /> : null}
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
        className="nb-btn h-12 w-12 rounded-xl p-0"
      >
        <Palette className="h-5 w-5" />
      </button>
    </div>
  );
}
