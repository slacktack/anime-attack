"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "@/components/ui/nav";

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/read/")) return null;

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--glass-border)] bg-ink-solid/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)] lg:hidden"
    >
      <div className="mx-auto flex h-[60px] max-w-xl items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = isActive(path, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-semibold transition-colors ${
                active ? "text-white" : "text-white/45 active:text-white/70"
              }`}
            >
              <item.Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
              <span className="whitespace-nowrap">{item.short}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
