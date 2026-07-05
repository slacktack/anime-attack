"use client";
import { useQuery } from "@tanstack/react-query";
import { getAnimeDetails, getCharacters, getRecommendations } from "@/lib/anime/anilist";
import { HeroBackdrop } from "@/components/ui/HeroBackdrop";
import { Carousel } from "@/components/ui/Carousel";
import { PosterCard } from "@/components/ui/PosterCard";
import { Card3D } from "@/components/ui/Card3D";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { ProgressControl } from "@/components/ui/ProgressControl";
import { AiPanel } from "@/components/screens/AiPanel";

export function AnimeDetail({ id }: { id: number }) {
  const { data: anime } = useQuery({ queryKey: ["anime", id], queryFn: () => getAnimeDetails(id) });
  const { data: chars } = useQuery({ queryKey: ["chars", id], queryFn: () => getCharacters(id) });
  const { data: recs } = useQuery({ queryKey: ["recs", id], queryFn: () => getRecommendations(id) });
  if (!anime) return <p className="p-8 text-white/40">Loading…</p>;

  return (
    <div className="relative pt-8">
      <HeroBackdrop tint="#7C3AED" />
      <div className="px-4">
        <div className="flex gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={anime.cover} alt={anime.title} className="h-56 w-40 rounded-2xl object-cover shadow-xl" />
          <div className="flex flex-col justify-end">
            <h1 className="text-2xl font-black">{anime.title}</h1>
            <p className="text-sm text-accent-gold">★ {anime.score ?? "–"} · {anime.type ?? ""} · {anime.episodes ?? "?"} eps</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {anime.genres.slice(0, 4).map((g) => <span key={g} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{g}</span>)}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <FavoriteButton anime={anime} />
          <ProgressControl anime={anime} maxEpisodes={anime.episodes} />
        </div>

        {anime.description && (
          <p className="mt-4 text-sm leading-relaxed text-white/70"
            dangerouslySetInnerHTML={{ __html: anime.description }} />
        )}

        <AiPanel anime={anime} />
      </div>

      {!!chars?.length && (
        <Carousel title="Characters">
          {chars.map((c) => (
            <Card3D key={c.id} className="w-24 shrink-0 overflow-hidden rounded-2xl bg-ink-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image ?? ""} alt={c.name} className="aspect-[2/3] w-full object-cover" />
              <p className="line-clamp-2 p-1 text-[10px]">{c.name}</p>
            </Card3D>
          ))}
        </Carousel>
      )}

      {!!recs?.length && (
        <Carousel title="You Might Like">{recs.map((a) => <PosterCard key={a.id} anime={a} />)}</Carousel>
      )}
    </div>
  );
}
