"use client";

import Link from "next/link";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Play } from "lucide-react";
import { fetchDiscover, fetchLatestEpisodes, fetchAnimeDetail } from "@/lib/client/api";
import { getContinueWatching } from "@/lib/storage/store";
import { PosterCard } from "@/components/ui/PosterCard";
import { Row } from "@/components/ui/Row";
import type { AnimeSummary } from "@/lib/anime/types";
import type { AniwatchEpisode } from "@/lib/anime/aniwatch-types";

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function parseEpisode(title: string) {
  const m = title.match(/^(.*?)\s+Episode\s+(\d+(?:\.\d+)?)\b\s*(.*)$/i);
  if (!m) return { series: title, episode: null as string | null, dub: /dub/i.test(title) };
  return { series: m[1], episode: m[2], dub: /dub/i.test(m[3]) };
}

function PosterSkeletons({ count = 8 }: { count?: number }) {
  return (
    <div className="aa-rail aa-gutter py-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aa-poster-w shrink-0">
          <div className="skeleton aspect-[2/3]" />
          <div className="skeleton mt-2 h-3 w-3/4 rounded" />
        </div>
      ))}
    </div>
  );
}

function PosterRail({
  title,
  href,
  query,
}: {
  title: string;
  href?: string;
  query: UseQueryResult<AnimeSummary[]>;
}) {
  const { data, isLoading } = query;
  if (!isLoading && !data?.length) return null;
  if (isLoading) {
    return (
      <section>
        <div className="aa-gutter">
          <div className="skeleton mb-3 h-5 w-40 rounded" />
        </div>
        <PosterSkeletons />
      </section>
    );
  }
  return (
    <Row title={title} href={href}>
      {data!.map((anime) => (
        <PosterCard key={anime.id} anime={anime} />
      ))}
    </Row>
  );
}

function TopTen({ items }: { items: AnimeSummary[] }) {
  if (items.length < 5) return null;
  return (
    <Row title="Top 10 this week" href="/browse">
      {items.slice(0, 10).map((anime, i) => (
        <Link
          key={anime.id}
          href={`/anime/${anime.id}`}
          prefetch={false}
          aria-label={`#${i + 1} ${anime.title}`}
          className="group flex shrink-0 items-end pl-1 pr-3 sm:pr-5"
        >
          <span
            aria-hidden
            className={`aa-rank relative z-0 text-[120px] sm:text-[150px] lg:text-[190px] 2xl:text-[220px] ${
              i === 9 ? "-mr-[0.06em] tracking-[-0.14em]" : "-mr-[0.1em]"
            }`}
          >
            {i + 1}
          </span>
          <span className="poster-frame relative z-10 block aspect-[2/3] w-[96px] ring-1 ring-inset ring-white/[0.06] sm:w-[112px] lg:w-[138px] 2xl:w-[158px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={anime.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
          </span>
        </Link>
      ))}
    </Row>
  );
}

function EpisodeCard({ ep, art }: { ep: AniwatchEpisode; art?: AnimeSummary }) {
  const { series, episode, dub } = parseEpisode(ep.title);
  const image = art?.banner || art?.cover;
  return (
    <Link
      href={`/watch/${ep.slug}${dub ? "?audio=dub" : ""}`}
      prefetch={false}
      className="group block w-[248px] shrink-0 sm:w-[280px] lg:w-[312px]"
    >
      <div className="aa-tile on-media aspect-video ring-1 ring-inset ring-white/[0.06]">
        {image ? (
          <div className="aa-tile-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" loading="lazy" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,color-mix(in_oklab,var(--accent-purple)_32%,transparent),transparent_60%),var(--ink-700)]" />
        )}
        <div className="aa-scrim-soft" />
        {episode && (
          <span className="absolute bottom-2 left-3 font-display text-[44px] font-extrabold leading-none tracking-[-0.05em] text-white [font-stretch:75%]">
            {episode}
          </span>
        )}
        <span className="absolute right-2 top-2 rounded-[5px] bg-black/70 px-1.5 py-0.5 text-[10.5px] font-bold text-white">
          {dub ? "DUB" : "SUB"}
        </span>
        <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/95 text-black shadow-xl">
            <Play size={20} fill="currentColor" className="ml-0.5" />
          </span>
        </span>
      </div>
      <p className="mt-2 line-clamp-1 text-[13.5px] font-semibold text-white/90 group-hover:text-white">{series}</p>
      <p className="mt-0.5 text-[12px] text-muted">
        {episode ? `Episode ${episode}` : "New episode"}
        <span className="mx-1.5 opacity-50">/</span>
        {timeAgo(ep.date)}
      </p>
    </Link>
  );
}

function LatestEpisodesRow({ library }: { library: AnimeSummary[] }) {
  const { data, isLoading } = useQuery({
    queryKey: ["aniwatch-latest"],
    queryFn: () => fetchLatestEpisodes(1, 16),
    staleTime: 2 * 60 * 1000,
  });

  const byTitle = useMemo(() => {
    const map = new Map<string, AnimeSummary>();
    for (const a of library) map.set(norm(a.title), a);
    return map;
  }, [library]);

  if (!isLoading && !data?.length) return null;
  if (isLoading) {
    return (
      <section>
        <div className="aa-gutter">
          <div className="skeleton mb-3 h-5 w-40 rounded" />
        </div>
        <div className="aa-rail aa-gutter py-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton aspect-video w-[248px] shrink-0 sm:w-[280px] lg:w-[312px]" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <Row title="New episodes">
      {data!.map((ep) => (
        <EpisodeCard key={ep.id} ep={ep} art={byTitle.get(norm(parseEpisode(ep.title).series))} />
      ))}
    </Row>
  );
}

export function HomeCarousels() {
  const [continueWatching, setContinueWatching] = useState<
    { anime: AnimeSummary; episode: number; malId?: number | null }[]
  >([]);

  useEffect(() => {
    setContinueWatching(
      getContinueWatching()
        .slice(0, 16)
        .map((p) => ({ anime: p.anime, episode: p.episode, malId: p.malId })),
    );
  }, []);

  const trending = useQuery({ queryKey: ["trending"], queryFn: () => fetchDiscover("trending") });
  const airing = useQuery({ queryKey: ["airing"], queryFn: () => fetchDiscover("airing") });
  const movies = useQuery({ queryKey: ["movies"], queryFn: () => fetchDiscover("movies") });

  const seedAnime = continueWatching[0]?.anime ?? trending.data?.[1] ?? trending.data?.[0];
  const seed = seedAnime?.id;
  const similar = useQuery({
    queryKey: ["home-similar", seed],
    queryFn: () => fetchAnimeDetail(seed as number).then((d) => d.recommendations),
    enabled: seed != null,
    staleTime: 10 * 60 * 1000,
  });

  const library = useMemo(
    () => [...(airing.data ?? []), ...(trending.data ?? [])],
    [airing.data, trending.data],
  );

  return (
    <div className="relative z-10 flex flex-col gap-8 lg:-mt-[clamp(70px,8vw,140px)] lg:gap-11">
      {continueWatching.length > 0 && (
        <Row title="Continue watching" href="/library">
          {continueWatching.map(({ anime, episode, malId }) => (
            <PosterCard
              key={anime.id}
              anime={anime}
              badge={episode > 0 ? `EP ${episode}` : undefined}
              href={
                malId
                  ? `/watch/${slugify(anime.title)}-episode-${Math.max(episode, 1)}?mal=${malId}&ep=${Math.max(episode, 1)}&audio=sub`
                  : `/anime/${anime.id}`
              }
            />
          ))}
        </Row>
      )}

      {trending.isLoading ? <PosterSkeletons /> : <TopTen items={trending.data ?? []} />}
      <LatestEpisodesRow library={library} />
      <PosterRail title="Airing this season" href="/browse" query={airing} />
      <PosterRail title="Popular movies" href="/browse" query={movies} />
      {seedAnime && (
        <PosterRail
          title={`${continueWatching.length ? "Because you watched" : "More like"} ${
            seedAnime.title.length > 34 ? `${seedAnime.title.slice(0, 32).trim()}…` : seedAnime.title
          }`}
          query={similar}
        />
      )}
    </div>
  );
}
