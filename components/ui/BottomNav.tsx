"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Compass,
  Drama,
  Home,
  Library,
  Search,
  type LucideIcon,
} from "lucide-react";

const items: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/search", label: "Search", Icon: Search },
  { href: "/browse", label: "Browse", Icon: Compass },
  { href: "/manga", label: "Manga", Icon: BookOpen },
  { href: "/characters", label: "Cast", Icon: Drama },
  { href: "/library", label: "Library", Icon: Library },
];

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/read/")) return null;

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
    >
      <div className="app-dock mx-auto flex max-w-md items-center gap-0.5 rounded-3xl p-1.5">
        {items.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[9px] font-bold uppercase tracking-[0.05em] transition-all ${
                active
                  ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "text-white/45 hover:text-white/70"
              }`}
            >
              <item.Icon
                size={20}
                strokeWidth={active ? 2.3 : 1.9}
                className={active ? "text-accent-purple" : ""}
              />
              <span className="whitespace-nowrap">{item.label}</span>
              {active && (
                <span className="absolute -top-0.5 h-1 w-5 rounded-full bg-gradient-to-r from-violet-400 to-sky-400" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
