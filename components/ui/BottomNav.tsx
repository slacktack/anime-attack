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
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/5 bg-ink-900/70 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.3)] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-3xl">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <Link key={it.href} href={it.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 min-h-11 text-[10px] leading-none transition-colors ${active ? "text-accent-purple" : "text-white/50"}`}>
              <span className={`h-1 w-1 rounded-full transition-colors ${active ? "bg-accent-purple" : "bg-transparent"}`} />
              <it.Icon size={20} color="currentColor" strokeWidth={2} />
              <span className="whitespace-nowrap">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
