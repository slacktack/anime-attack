"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getTrending, getTopAiring, getPopularMovies } from "@/lib/anime/anilist";
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
    </>
  );
}
