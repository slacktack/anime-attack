"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Info, Play, Star } from "lucide-react";
import { fetchFeatured, type FeaturedItem } from "@/lib/client/api";
import { HeroArt } from "@/components/ui/HeroArt";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { htmlToText } from "@/lib/ui/htmlToText";

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const ROTATE_MS = 9000;

// Bound by both width and height so short windows never push the title into the header.
function titleSize(title: string): string {
  if (title.length > 48) return "text-[32px] sm:text-[42px] lg:text-[clamp(38px,min(3.8vw,6.5vh),64px)]";
  if (title.length > 26) return "text-[40px] sm:text-[52px] lg:text-[clamp(46px,min(4.8vw,8.5vh),88px)]";
  return "text-[48px] sm:text-[64px] lg:text-[clamp(56px,min(6.2vw,11vh),116px)]";
}

export function HomeHero() {
  const { data, isLoading } = useQuery({
    queryKey: ["featured"],
    queryFn: fetchFeatured,
    staleTime: 10 * 60 * 1000,
  });

  const featured = useMemo<FeaturedItem[]>(() => (data ?? []).slice(0, 6), [data]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = featured[Math.min(index, Math.max(featured.length - 1, 0))];

  useEffect(() => {
    if (featured.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % featured.length), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [featured.length, paused, index]);

  const touchX = useRef<number | null>(null);
  const wheelLock = useRef(0);
  const go = (dir: 1 | -1) => {
    if (featured.length < 2) return;
    setIndex((i) => (i + dir + featured.length) % featured.length);
  };

  if (isLoading || !active) {
    return <section className="skeleton h-[78svh] max-h-[760px] min-h-[520px] w-full rounded-none lg:h-[min(84vh,50vw)]" />;
  }

  const params = new URLSearchParams({ audio: "sub", ep: "1" });
  if (active.malId) params.set("mal", String(active.malId));
  const watchHref = `/watch/${slugify(active.title)}-episode-1?${params.toString()}`;
  const ready = true;
  const isMovie = active.type === "MOVIE";
  const story = htmlToText(active.description).replace(/\s+/g, " ");
  const genres = active.genres.slice(0, 3);
  const eps = active.episodes;
  const airing = active.status === "RELEASING";

  return (
    <section
      className="on-media relative h-[78svh] max-h-[760px] min-h-[520px] w-full overflow-hidden bg-black lg:h-[min(84vh,50vw)] lg:max-h-[980px] lg:min-h-[600px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null || Math.abs(end - start) < 45) return;
        go(end < start ? 1 : -1);
      }}
      onWheel={(e) => {
        // trackpad horizontal swipe; vertical wheel keeps scrolling the page
        if (Math.abs(e.deltaX) < 25 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
        const now = Date.now();
        if (now - wheelLock.current < 700) return;
        wheelLock.current = now;
        go(e.deltaX > 0 ? 1 : -1);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      aria-roledescription="carousel"
      aria-label="Featured"
    >
      {featured.map((item, i) => (
        <div
          key={item.id}
          aria-hidden
          className={`absolute inset-0 transition-opacity duration-[1100ms] ease-out ${i === index ? "opacity-100" : "opacity-0"}`}
        >
          <HeroArt backdrop={item.backdrop} banner={item.banner} cover={item.cover} eager={i === 0} animate={i === index} />
        </div>
      ))}

      {/* scrims: side for copy legibility, bottom to melt into the page */}
      <div className="absolute inset-0 hidden bg-[linear-gradient(77deg,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.55)_30%,transparent_62%)] lg:block" />
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-[linear-gradient(to_top,var(--ink-solid)_0%,color-mix(in_oklab,var(--ink-solid)_75%,transparent)_30%,transparent_100%)] lg:h-[38%]" />

      <div className="aa-gutter absolute inset-0 flex flex-col justify-end overflow-hidden pb-12 pt-[calc(var(--header-h)+env(safe-area-inset-top)+20px)] lg:pb-[clamp(110px,min(13vw,20vh),210px)]">
        <div key={active.id} className="aa-in mx-auto flex max-w-[640px] flex-col items-center text-center lg:mx-0 lg:items-start lg:text-left">
          <h1 className={`aa-billboard-title line-clamp-3 text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)] ${titleSize(active.title)}`}>
            {active.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[14px] font-medium text-white/80 lg:justify-start lg:text-[15px]">
            {active.score != null && (
              <span className="flex items-center gap-1 font-bold text-accent-gold">
                <Star size={14} fill="currentColor" />
                {active.score.toFixed(1)}
              </span>
            )}
            {airing && <span className="font-semibold text-emerald-400">Airing</span>}
            {active.year && <span>{active.year}</span>}
            {active.type && <span>{isMovie ? "Movie" : active.type}</span>}
            {eps != null && eps > 1 && <span>{eps} episodes</span>}
          </div>

          {story && (
            <p className="mt-4 hidden max-w-[56ch] text-[15px] leading-relaxed text-white/80 lg:line-clamp-3 xl:text-[16px]">
              {story}
            </p>
          )}

          {genres.length > 0 && (
            <p className="mt-2.5 text-[13px] font-medium text-white/70 lg:hidden">{genres.join("  •  ")}</p>
          )}

          <div className="mt-5 flex w-full items-center justify-center gap-2.5 lg:mt-6 lg:w-auto lg:justify-start lg:gap-3">
            <Link
              href={watchHref}
              prefetch={false}
              aria-disabled={!ready}
              className={`aa-cta min-w-0 flex-1 sm:flex-none lg:min-h-[52px] lg:px-8 lg:text-[17px] ${ready ? "" : "pointer-events-none opacity-70"}`}
            >
              <Play size={20} fill="currentColor" />
              {isMovie ? "Play movie" : "Play"}
            </Link>
            <Link
              href={`/anime/${active.id}`}
              className="aa-cta-ghost min-w-0 flex-1 sm:flex-none lg:min-h-[52px] lg:px-7 lg:text-[17px]"
            >
              <Info size={20} />
              More info
            </Link>
            <FavoriteButton anime={active} iconOnly />
          </div>
        </div>
      </div>

      {featured.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous title"
            className="group/arrow absolute inset-y-0 left-0 z-10 hidden w-[var(--gutter)] min-w-12 items-center justify-center text-white/0 transition-colors hover:text-white lg:flex [section:hover_&]:text-white/70"
          >
            <ChevronLeft size={40} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next title"
            className="absolute inset-y-0 right-0 z-10 hidden w-[var(--gutter)] min-w-12 items-center justify-center text-white/0 transition-colors hover:text-white lg:flex [section:hover_&]:text-white/70"
          >
            <ChevronRight size={40} strokeWidth={1.8} />
          </button>
        </>
      )}

      {featured.length > 1 && (
        <div className="aa-gutter absolute inset-x-0 bottom-3 flex justify-center gap-1.5 lg:bottom-[clamp(72px,min(9vw,13vh),150px)] lg:justify-end">
          {featured.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show ${item.title}`}
              aria-current={i === index}
              className="group relative h-6 w-7 lg:w-9"
            >
              <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/25 transition-colors group-hover:bg-white/45">
                {i === index && (
                  <span
                    key={`${index}-${paused}`}
                    className="block h-full origin-left rounded-full bg-white"
                    style={{
                      animation: paused ? "none" : `aa-fill ${ROTATE_MS}ms linear both`,
                      transform: paused ? "scaleX(1)" : undefined,
                    }}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
