"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { useTheme } from "@/components/ui/ThemeProvider";

export function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Change theme"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] transition-colors hover:bg-white/[0.1]"
      >
        <Palette size={18} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choose theme"
          className="app-dock absolute right-0 top-12 z-[60] w-60 origin-top-right rounded-2xl p-2"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
            Appearance
          </p>
          {themes.map((item) => {
            const active = item.id === theme;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(item.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                  active ? "bg-white/[0.09]" : "hover:bg-white/[0.06]"
                }`}
              >
                <span
                  className="h-6 w-6 flex-none rounded-full border border-white/15 shadow-inner"
                  style={{ backgroundColor: item.primary }}
                  aria-hidden
                />
                <span className="flex-1">{item.label}</span>
                {active && <Check size={15} className="text-white/70" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
