"use client";

import Link from "next/link";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Clock, Play, Star } from "lucide-react";
import {
  fetchDiscover,
  fetchLatestEpisodes,
  fetchAnimeDetail,
} from "@/lib/client/api";
import { getContinueWatching } from "@/lib/storage/store";
import { PosterCard } from "@/components/ui/PosterCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { AnimeSummary } from "@/lib/anime/types";

function RailSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="aa-rail -mx-3 px-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton h-[186px] w-[124px] shrink-0 rounded-2xl" />
      ))}
    </div>
  );
}

function PosterRail({
  title,
  href,
  query,
  hint,
}: {
  title: string;
  href?: string;
  hint?: string;
  query: UseQueryResult<AnimeSummary[]>;
}) {
  const { data, isLoading } = query;
  if (!isLoading && !data?.length) return null;

  return (
    <section className="aa-in">
      <SectionHeader title={title} href={href} hint={hint} />
      {isLoading ? (
        <RailSkeletons />
      ) : (
        <div className="aa-rail no-scrollbar -mx-3 px-3 pb-1">
          {data!.map((anime) => (
            <PosterCard key={anime.id} anime={anime} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Three-up bento built from the trending list: one feature tile + two compact. */
function TrendingBento({ items }: { items: AnimeSummary[] }) {
  if (items.length < 3) return null;
  const [feature, second, third] = items;

  return (
    <section className="aa-in">
      <SectionHeader title="Trending now" href="/browse" />
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/anime/${feature.id}`}
          prefetch={false}
          className="aa-tile group relative col-span-1 row-span-2 flex h-[264px] flex-col justify-end p-3"
        >
          <div className="aa-tile-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={feature.banner || feature.cover} alt="" />
          </div>
          <div className="aa-scrim" />
          <div className="relative">
            <span className="aa-pill border-amber-300/30 bg-black/45 text-[9.5px] text-amber-200 backdrop-blur">
              <Star size={9} fill="currentColor" /> {feature.score ?? "—"}
            </span>
            <p className="mt-1.5 line-clamp-3 font-display text-[15px] font-bold leading-tight text-white">
              {feature.title}
            </p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-white/45">
              {[feature.type, feature.year].filter(Boolean).join(" · ")}
            </p>
          </div>
        </Link>

        {[second, third].map((item) => (
          <Link
            key={item.id}
            href={`/anime/${item.id}`}
            prefetch={false}
            className="aa-tile group relative flex h-[128px] flex-col justify-end p-2.5"
          >
            <div className="aa-tile-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.cover} alt="" />
            </div>
            <div className="aa-scrim" />
            <div className="relative">
              <p className="line-clamp-2 font-display text-[12px] font-bold leading-tight text-white">
                {item.title}
              </p>
              {item.score != null && (
                <p className="mt-0.5 flex items-center gap-0.5 text-[9.5px] font-black text-amber-300">
                  <Star size={8} fill="currentColor" /> {item.score}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function LatestEpisodesRow() {
  const { data, isLoading } = useQuery({
    queryKey: ["aniwatch-latest"],
    queryFn: () => fetchLatestEpisodes(1, 14),
    staleTime: 2 * 60 * 1000,
  });

  if (!isLoading && !data?.length) return null;

  return (
    <section className="aa-in">
      <SectionHeader
        title="Fresh episodes"
        hint={isLoading ? undefined : `${data?.length ?? 0}`}
      />
      {isLoading ? (
        <div className="aa-rail -mx-3 px-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-[92px] w-[196px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="aa-rail no-scrollbar -mx-3 px-3 pb-1">
          {data!.map((ep) => (
            <Link
              key={ep.id}
              href={`/watch/${ep.slug}`}
              prefetch={false}
              className="aa-card aa-card-raise flex w-[196px] shrink-0 items-center gap-2.5 p-2.5"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-400 text-white">
                <Play size={15} fill="currentColor" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block font-display text-[11.5px] font-bold leading-tight">
                  {ep.title}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[9.5px] font-semibold text-white/40">
                  <Clock size={9} />
                  {new Date(ep.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function HomeCarousels() {
  const [continueWatching, setContinueWatching] = useState<
    { anime: AnimeSummary; episode: number }[]
  >([]);

  useEffect(() => {
    setContinueWatching(
      getContinueWatching()
        .slice(0, 12)
        .map((p) => ({ anime: p.anime, episode: p.episode })),
    );
  }, []);

  const trending = useQuery({ queryKey: ["trending"], queryFn: () => fetchDiscover("trending") });
  const airing = useQuery({ queryKey: ["airing"], queryFn: () => fetchDiscover("airing") });
  const movies = useQuery({ queryKey: ["movies"], queryFn: () => fetchDiscover("movies") });

  const seed = trending.data?.[1]?.id ?? trending.data?.[0]?.id;
  const similar = useQuery({
    queryKey: ["home-similar", seed],
    queryFn: () => fetchAnimeDetail(seed as number).then((d) => d.recommendations),
    enabled: seed != null,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="flex flex-col gap-6 px-3 pt-1">
      {continueWatching.length > 0 && (
        <section className="aa-in">
          <SectionHeader title="Continue watching" href="/library" />
          <div className="aa-rail no-scrollbar -mx-3 px-3 pb-1">
            {continueWatching.map(({ anime, episode }) => (
              <div key={anime.id} className="relative shrink-0">
                <PosterCard anime={anime} />
                {episode > 0 && (
                  <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-black text-white backdrop-blur">
                    EP {episode}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {trending.isLoading ? (
        <section>
          <SectionHeader title="Trending now" href="/browse" />
          <div className="grid grid-cols-2 gap-2">
            <div className="skeleton h-[264px] rounded-[22px]" />
            <div className="flex flex-col gap-2">
              <div className="skeleton h-[128px] rounded-[22px]" />
              <div className="skeleton h-[128px] rounded-[22px]" />
            </div>
          </div>
        </section>
      ) : (
        <TrendingBento items={(trending.data ?? []).slice(0, 3)} />
      )}

      <PosterRail title="Top airing" href="/browse" query={airing} />
      <LatestEpisodesRow />
      <PosterRail title="Popular movies" href="/browse" query={movies} />
      <PosterRail title="Picked for you" href="/browse" query={similar} />
    </div>
  );
}
