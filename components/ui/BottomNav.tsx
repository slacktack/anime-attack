"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/search", label: "Search", icon: "🔍" },
  { href: "/library", label: "Library", icon: "📚" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/5 bg-ink-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <Link key={it.href} href={it.href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors ${active ? "text-accent-purple" : "text-white/50"}`}>
              <span className="text-lg">{it.icon}</span>{it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
