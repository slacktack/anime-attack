"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { getRelations } from "@/lib/anime/anilist";
import type { RelatedAnime } from "@/lib/anime/types";

const TYPE_LABEL: Record<string, string> = {
  PREQUEL: "Earlier",
  SEQUEL: "Later",
  PARENT: "Main story",
  SIDE_STORY: "Side story",
  ALTERNATIVE: "Alternate",
  SPIN_OFF: "Spin-off",
};

function shortTitle(title: string, fallback: string): string {
  const stripped = title
    .replace(/\s*\b(season|part|cour)\s*\d+\b/gi, "")
    .replace(/\s*\b\d+(st|nd|rd|th)\s+season\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || fallback;
}

function PillSkeleton() {
  return (
    <div className="flex gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-[74px] w-[132px] shrink-0 rounded-2xl" />
      ))}
    </div>
  );
}

/**
 * Horizontal season / related-series switcher built from AniList relations.
 * Sorted oldest → newest so it reads Season 1 → N.
 */
export function SeasonSwitcher({ id, title }: { id: number; title: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["relations", id],
    queryFn: () => getRelations(id),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const related = data ?? [];
  const seasons = related.filter((r) => r.type === "TV" || r.type === "ONA");
  const extras = related.filter((r) => r.type !== "TV" && r.type !== "ONA");
  const ordered = [...seasons, ...extras];

  // Reserve space while loading so the page does not jump.
  if (isLoading) {
    return (
      <section className="nb-card p-4">
        <div className="nb-section-header">
          <span className="flex items-center gap-2">
            <Layers size={15} className="text-accent-purple" />
            Seasons
          </span>
        </div>
        <PillSkeleton />
      </section>
    );
  }

  // No relations at all, or the lookup failed: do not render an empty shell.
  if (isError || ordered.length === 0) return null;

  const root = shortTitle(title, title);

  return (
    <section className="nb-card p-4">
      <div className="nb-section-header">
        <span className="flex items-center gap-2">
          <Layers size={15} className="text-accent-purple" />
          Seasons &amp; related
        </span>
        <span className="text-[11px] font-semibold tracking-normal text-white/35">
          {ordered.length + 1} titles
        </span>
      </div>

      <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
        {/* Current title, always first and highlighted */}
        <div
          aria-current="page"
          className="relative flex w-[136px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl border border-transparent p-2.5"
          style={{
            background:
              "linear-gradient(150deg, color-mix(in oklab, var(--accent-purple) 42%, transparent), color-mix(in oklab, var(--accent-blue) 26%, transparent))",
            boxShadow: "0 18px 34px -20px color-mix(in oklab, var(--accent-purple) 80%, transparent)",
          }}
        >
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/80">
            You are here
          </span>
          <span className="mt-1 line-clamp-2 font-display text-[12.5px] font-bold leading-tight text-white">
            {root}
          </span>
        </div>

        {ordered.map((r) => (
          <SeasonPill key={`${r.relationType}-${r.id}`} item={r} />
        ))}
      </div>
    </section>
  );
}

function SeasonPill({ item }: { item: RelatedAnime }) {
  const label = TYPE_LABEL[item.relationType] ?? "Related";
  const sub =
    item.type === "MOVIE"
      ? "Movie"
      : item.episodes
        ? `${item.episodes} ep`
        : "Series";

  return (
    <Link
      href={`/anime/${item.id}`}
      prefetch={false}
      className="group relative flex w-[136px] shrink-0 snap-start items-center gap-2 overflow-hidden rounded-2xl border border-nb-border bg-ink-800 p-2 transition-all hover:border-white/25 hover:bg-ink-700 active:scale-[0.98]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.cover}
        alt=""
        loading="lazy"
        className="h-[50px] w-[36px] shrink-0 rounded-lg object-cover"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-white/40">
          {label}
        </span>
        <span className="line-clamp-2 font-display text-[11.5px] font-bold leading-tight text-white/90">
          {shortTitle(item.title, item.title)}
        </span>
        <span className="mt-0.5 text-[9.5px] font-semibold text-white/35">
          {item.year ? `${item.year} · ` : ""}
          {sub}
        </span>
      </span>
    </Link>
  );
}
