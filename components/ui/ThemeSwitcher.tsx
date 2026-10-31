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
        className="grid h-11 w-11 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Palette size={20} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choose theme"
          className="app-dock absolute right-0 top-13 z-[60] w-56 origin-top-right rounded-xl p-1.5 text-white"
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[12px] font-semibold text-white/45">Theme</p>
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
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors ${
                  active ? "bg-white/[0.09]" : "hover:bg-white/[0.06]"
                }`}
              >
                <span
                  className="h-5 w-5 flex-none rounded-full border border-white/15 shadow-inner"
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
