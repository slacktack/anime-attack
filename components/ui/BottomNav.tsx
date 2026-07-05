"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Compass, Drama, Library, type LucideIcon } from "lucide-react";

const items: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/search", label: "Search", Icon: Search },
  { href: "/browse", label: "Browse", Icon: Compass },
  { href: "/characters", label: "Characters", Icon: Drama },
  { href: "/library", label: "Library", Icon: Library },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t-2 border-nb-border bg-ink-800 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-3xl">
        {items.map((it, i) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          const isLast = i === items.length - 1;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`
                flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 min-h-12
                font-bold text-[10px] uppercase tracking-wider leading-none
                transition-colors
                ${!isLast ? "border-r border-nb-border" : ""}
                ${active
                  ? "bg-ink-solid nb-shadow-sm border-b-2 border-b-accent-purple text-accent-purple"
                  : "text-white/60 hover:text-white/80"
                }
              `}
            >
              <it.Icon size={20} color="currentColor" strokeWidth={2} />
              <span className="whitespace-nowrap">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
