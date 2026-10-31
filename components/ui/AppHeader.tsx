"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { NAV_ITEMS, isActive } from "@/components/ui/nav";

function sectionLabel(path: string): string {
  if (path.startsWith("/watch")) return "Now playing";
  if (path.startsWith("/anime")) return "Details";
  if (path.startsWith("/manga")) return "Manga";
  if (path.startsWith("/browse")) return "Browse";
  if (path.startsWith("/search")) return "Search";
  if (path.startsWith("/library")) return "My list";
  if (path.startsWith("/character")) return "Characters";
  if (path.startsWith("/schedule")) return "Schedule";
  return "";
}

// Pages whose first element is full-bleed media the header can float over.
function overlaysMedia(path: string): boolean {
  return path === "/" || path.startsWith("/anime/") || path.startsWith("/manga/");
}

function Wordmark() {
  return (
    <Link href="/" aria-label="Anime Attack home" className="flex shrink-0 items-center gap-2 rounded-md">
      <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent-purple font-display text-[15px] font-extrabold text-white">
        A
      </span>
      <span className="font-display text-[19px] font-extrabold tracking-[-0.04em] [font-stretch:80%]">
        anime<span className="text-accent-purple">attack</span>
      </span>
    </Link>
  );
}

export function AppHeader() {
  const path = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [path]);

  if (path.startsWith("/read/")) return null;

  const home = path === "/";
  const floating = overlaysMedia(path);
  const solid = scrolled || !floating;

  return (
    <>
      <header
        className={`pt-safe fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-300 ${
          solid
            ? "bg-ink-solid/92 shadow-[0_1px_0_var(--glass-border)] backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)]"
            : "bg-gradient-to-b from-black/75 via-black/25 to-transparent"
        }`}
      >
        <div className={`aa-gutter flex h-[var(--header-h)] items-center gap-3 ${!solid ? "on-media" : ""}`}>
          {/* mobile: logo on home, back + title elsewhere */}
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            {home ? (
              <Wordmark />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (window.history.length > 1) router.back();
                    else router.push("/");
                  }}
                  aria-label="Go back"
                  className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors active:bg-white/10"
                >
                  <ArrowLeft size={22} />
                </button>
                <span className="truncate font-display text-[17px] font-bold">{sectionLabel(path)}</span>
              </>
            )}
          </div>

          {/* desktop: logo + full nav */}
          <div className="hidden min-w-0 items-center gap-9 lg:flex">
            <Wordmark />
            <nav aria-label="Primary" className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(path, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-3 py-2 text-[14px] transition-colors ${
                      active ? "font-bold text-white" : "font-medium text-white/65 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex-1" />

          <Link
            href="/search"
            aria-label="Search"
            className="grid h-11 w-11 place-items-center rounded-full text-white/85 transition-colors hover:bg-[color:var(--glass-strong)] hover:text-white"
          >
            <Search size={21} />
          </Link>
          <ThemeSwitcher />
        </div>
      </header>
      {!floating && <div aria-hidden className="pt-safe h-[var(--header-h)] box-content" />}
    </>
  );
}
