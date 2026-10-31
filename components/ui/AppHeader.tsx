"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clapperboard, Search } from "lucide-react";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

function sectionLabel(path: string): string {
  if (path.startsWith("/watch")) return "Now playing";
  if (path.startsWith("/anime")) return "Details";
  if (path.startsWith("/manga")) return "Manga";
  if (path.startsWith("/browse")) return "Browse";
  if (path.startsWith("/search")) return "Search";
  if (path.startsWith("/library")) return "Library";
  if (path.startsWith("/characters") || path.startsWith("/character")) return "Characters";
  if (path.startsWith("/schedule")) return "Schedule";
  return "Anime Attack";
}

export function AppHeader() {
  const path = usePathname();
  const router = useRouter();
  if (path.startsWith("/read/")) return null;

  const home = path === "/";

  return (
    <header className="sticky top-0 z-50 px-4 pt-2">
      <div className="app-dock mx-auto flex h-14 max-w-6xl items-center gap-1.5 rounded-2xl px-2">
        {home ? (
          <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-sky-400 text-white shadow-[0_10px_26px_-10px_rgba(139,92,246,0.9)]">
              <Clapperboard size={18} />
            </span>
            <span className="font-display truncate text-[15px] font-bold tracking-tight">
              Anime Attack
            </span>
          </Link>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) router.back();
                else router.push("/");
              }}
              aria-label="Go back"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] transition-colors hover:bg-white/[0.1]"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="font-display truncate px-1 text-sm font-semibold text-white/70">
              {sectionLabel(path)}
            </span>
          </>
        )}

        <div className="flex-1" />

        <Link
          href="/search"
          aria-label="Search anime"
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] transition-colors hover:bg-white/[0.1]"
        >
          <Search size={18} />
        </Link>
        <ThemeSwitcher />
      </div>
    </header>
  );
}
