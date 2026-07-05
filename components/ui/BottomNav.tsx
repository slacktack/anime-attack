"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/search", label: "Search", icon: "🔍" },
  { href: "/browse", label: "Browse", icon: "🧭" },
  { href: "/characters", label: "Characters", icon: "🎭" },
  { href: "/library", label: "Library", icon: "📚" },
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
              <span className="text-lg leading-none">{it.icon}</span>
              <span className="whitespace-nowrap">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
