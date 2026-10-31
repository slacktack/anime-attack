"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, Play, Star } from "lucide-react";
import { fetchDiscover, fetchAnimeDetail } from "@/lib/client/api";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { htmlToText } from "@/lib/ui/htmlToText";
import type { AnimeSummary } from "@/lib/anime/types";

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const ROTATE_MS = 9000;

function titleSize(title: string): string {
  if (title.length > 48) return "text-[34px] sm:text-[44px] lg:text-[clamp(44px,4vw,68px)]";
  if (title.length > 26) return "text-[42px] sm:text-[56px] lg:text-[clamp(56px,5.2vw,92px)]";
  return "text-[52px] sm:text-[68px] lg:text-[clamp(72px,6.6vw,124px)]";
}

export function HomeHero() {
  const { data, isLoading } = useQuery({
    queryKey: ["trending"],
    queryFn: () => fetchDiscover("trending"),
    staleTime: 5 * 60 * 1000,
  });

  const featured = useMemo<AnimeSummary[]>(() => (data ?? []).slice(0, 6), [data]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = featured[Math.min(index, Math.max(featured.length - 1, 0))];

  useEffect(() => {
    if (featured.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % featured.length), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [featured.length, paused, index]);

  const detail = useQuery({
    queryKey: ["hero-detail", active?.id],
    queryFn: () => fetchAnimeDetail(active!.id),
    enabled: !!active,
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading || !active) {
    return <section className="skeleton h-[78svh] max-h-[760px] min-h-[520px] w-full rounded-none lg:h-[min(88vh,56vw)]" />;
  }

  const info = detail.data?.anime.id === active.id ? detail.data : undefined;
  const params = new URLSearchParams({ audio: "sub", ep: "1" });
  if (info?.malId) params.set("mal", String(info.malId));
  const watchHref = `/watch/${slugify(active.title)}-episode-1?${params.toString()}`;
  const ready = !!info;
  const isMovie = active.type === "MOVIE";
  const story = htmlToText(info?.anime.description).replace(/\s+/g, " ");
  const genres = info?.anime.genres.slice(0, 3) ?? [];
  const eps = info?.anime.episodes;
  const airing = info?.anime.status === "RELEASING";

  return (
    <section
      className="on-media relative h-[78svh] max-h-[760px] min-h-[520px] w-full overflow-hidden bg-black lg:h-[min(88vh,56vw)] lg:max-h-[980px] lg:min-h-[600px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured"
    >
      {featured.map((item, i) => (
        <picture
          key={item.id}
          aria-hidden
          className={`absolute inset-0 transition-opacity duration-[1100ms] ease-out ${i === index ? "opacity-100" : "opacity-0"}`}
        >
          <source media="(min-width: 1024px)" srcSet={item.banner || item.cover} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.cover}
            alt=""
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "auto"}
            className={`h-full w-full object-cover object-[50%_22%] ${i === index ? "aa-xfade" : ""}`}
          />
        </picture>
      ))}

      {/* scrims: side for copy legibility, bottom to melt into the page */}
      <div className="absolute inset-0 hidden bg-[linear-gradient(77deg,rgba(0,0,0,0.88)_0%,rgba(0,0,0,0.55)_30%,transparent_62%)] lg:block" />
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-[linear-gradient(to_top,var(--ink-solid)_0%,color-mix(in_oklab,var(--ink-solid)_75%,transparent)_30%,transparent_100%)] lg:h-[38%]" />

      <div className="aa-gutter absolute inset-x-0 bottom-0 pb-12 lg:bottom-[clamp(120px,15vw,220px)] lg:pb-0">
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
        <div className="aa-gutter absolute inset-x-0 bottom-3 flex justify-center gap-1.5 lg:bottom-[clamp(84px,10.5vw,160px)] lg:justify-end">
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
