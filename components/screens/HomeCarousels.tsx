"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getTrending, getTopAiring, getPopularMovies } from "@/lib/anime/anilist";
import { fetchLatestEpisodes } from "@/lib/anime/aniwatch";
import { getContinueWatching } from "@/lib/storage/store";
import { Carousel } from "@/components/ui/Carousel";
import { PosterCard } from "@/components/ui/PosterCard";
import { Reveal } from "@/components/ui/Reveal";
import type { AnimeSummary } from "@/lib/anime/types";

function Row({ title, queryKey, fn }: { title: string; queryKey: string; fn: () => Promise<AnimeSummary[]> }) {
  const { data } = useQuery({ queryKey: [queryKey], queryFn: fn });
  if (!data?.length) return null;
  return (
    <Reveal>
      <Carousel title={title}>{data.map((a) => <PosterCard key={a.id} anime={a} />)}</Carousel>
    </Reveal>
  );
}

function AniwatchRow() {
  const { data } = useQuery({
    queryKey: ["aniwatch-latest"],
    queryFn: () => fetchLatestEpisodes(1, 12),
  });
  if (!data?.length) return null;
  return (
    <Reveal>
      <Carousel title="From AniwatchTV">
        {data.map((ep) => (
          <Link
            key={ep.id}
            href={`/watch/${ep.slug}`}
            className="nb-card-sm bg-ink-700 p-3 w-40 shrink-0 block"
          >
            <p className="font-display text-xs font-bold leading-tight line-clamp-2">
              {ep.title}
            </p>
            <p className="mt-1 text-[10px] text-white/50">
              {new Date(ep.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <span className="nb-tag mt-1 text-accent-progress">WATCH</span>
          </Link>
        ))}
      </Carousel>
    </Reveal>
  );
}

export function HomeCarousels() {
  const [cw, setCw] = useState<AnimeSummary[]>([]);
  useEffect(() => setCw(getContinueWatching().map((p) => p.anime)), []);
  return (
    <>
      {cw.length > 0 && (
        <Reveal>
          <Carousel title="Continue Watching">{cw.map((a) => <PosterCard key={a.id} anime={a} />)}</Carousel>
        </Reveal>
      )}
      <Row title="Trending Today" queryKey="trending" fn={getTrending} />
      <Row title="Top Airing" queryKey="airing" fn={getTopAiring} />
      <Row title="Popular Movies" queryKey="movies" fn={getPopularMovies} />
      <AniwatchRow />
    </>
  );
}
