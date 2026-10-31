"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, Play, Sparkles, Star } from "lucide-react";
import { fetchDiscover, fetchAnimeDetail } from "@/lib/client/api";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import type { AnimeSummary } from "@/lib/anime/types";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ROTATE_MS = 8000;

export function HomeHero() {
  const { data, isLoading } = useQuery({
    queryKey: ["trending"],
    queryFn: () => fetchDiscover("trending"),
    staleTime: 5 * 60 * 1000,
  });

  const featured = useMemo<AnimeSummary[]>(() => (data ?? []).slice(0, 5), [data]);
  const [index, setIndex] = useState(0);
  const active = featured[Math.min(index, Math.max(featured.length - 1, 0))];

  useEffect(() => {
    if (featured.length < 2 || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % featured.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [featured.length]);

  const detail = useQuery({
    queryKey: ["hero-detail", active?.id],
    queryFn: () => fetchAnimeDetail(active!.id),
    enabled: !!active,
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading || !active) {
    return (
      <section className="px-3 pt-2">
        <div className="skeleton aspect-[3/4] w-full rounded-[26px]" />
      </section>
    );
  }

  const malId = detail.data?.malId ?? null;
  const params = new URLSearchParams({ audio: "sub", ep: "1" });
  if (malId) params.set("mal", String(malId));
  const watchHref = `/watch/${slugify(active.title)}-episode-1?${params.toString()}`;
  const isMovie = active.type === "MOVIE";

  return (
    <section className="px-3 pt-2">
      <div className="aa-tile relative flex aspect-[3/4] max-h-[560px] flex-col justify-between">
        <div key={active.id} className="aa-tile-media aa-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.banner || active.cover} alt="" />
        </div>
        <div className="aa-scrim" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 70% at 10% 108%, color-mix(in oklab, var(--accent-purple) 34%, transparent), transparent 62%)",
          }}
        />

        {/* top row */}
        <div className="relative flex items-start justify-between gap-2 p-4">
          <span className="aa-pill border-white/25 bg-black/35 text-white backdrop-blur-md">
            <Sparkles size={11} className="text-amber-300" />
            Spotlight · #{index + 1}
          </span>
          {active.score != null && (
            <span className="aa-pill border-amber-300/30 bg-black/40 text-amber-200 backdrop-blur-md">
              <Star size={11} fill="currentColor" />
              {active.score}
            </span>
          )}
        </div>

        {/* bottom block */}
        <div className="relative flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {active.type && (
              <span className="aa-pill border-white/20 bg-white/12 text-white backdrop-blur-md">
                {active.type}
              </span>
            )}
            {active.year && (
              <span className="aa-pill border-white/15 bg-white/[0.08] text-white/75 backdrop-blur-md">
                {active.year}
              </span>
            )}
            <span className="aa-pill border-white/15 bg-white/[0.08] text-white/75 backdrop-blur-md">
              Sub &amp; Dub
            </span>
          </div>

          <h1 className="aa-title-lg line-clamp-3 text-[30px] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.65)]">
            {active.title}
          </h1>

          <div className="flex items-center gap-2">
            <Link href={watchHref} prefetch={false} className="aa-cta flex-1">
              <Play size={17} fill="currentColor" />
              {isMovie ? "Watch movie" : "Play episode 1"}
            </Link>
            <FavoriteButton anime={active} iconOnly />
            <Link
              href={`/anime/${active.id}`}
              className="aa-iconbtn"
              aria-label="More details"
            >
              <Info size={19} />
            </Link>
          </div>

          {featured.length > 1 && (
            <div className="flex items-center gap-1.5">
              {featured.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show ${item.title}`}
                  aria-current={i === index}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === index
                      ? "w-7 bg-gradient-to-r from-violet-400 to-sky-400"
                      : "w-4 bg-white/22 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
