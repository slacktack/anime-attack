"use client";
import Link from "next/link";
import { Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAnimeDetails, getCharacters, getRecommendations } from "@/lib/anime/anilist";
import { getAnimeExtras } from "@/lib/anime/anilist-extra";
import { findCategory } from "@/lib/anime/aniwatch";
import { htmlToText } from "@/lib/ui/htmlToText";
import { AuroraBackdrop } from "@/components/ui/AuroraBackdrop";
import { Carousel } from "@/components/ui/Carousel";
import { PosterCard } from "@/components/ui/PosterCard";
import { Card3D } from "@/components/ui/Card3D";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { ProgressControl } from "@/components/ui/ProgressControl";
import { AiPanel } from "@/components/screens/AiPanel";
import { EpisodeList } from "@/components/screens/EpisodeList";

export function AnimeDetail({ id }: { id: number }) {
  const { data: anime } = useQuery({ queryKey: ["anime", id], queryFn: () => getAnimeDetails(id) });
  const { data: chars } = useQuery({ queryKey: ["chars", id], queryFn: () => getCharacters(id) });
  const { data: recs } = useQuery({ queryKey: ["recs", id], queryFn: () => getRecommendations(id) });
  const { data: extras } = useQuery({ queryKey: ["extras", id], queryFn: () => getAnimeExtras(id) });
  const { data: aniwatchCat } = useQuery({
    queryKey: ["aniwatch-cat", anime?.title],
    queryFn: async () => {
      // Try 1: exact title
      let results = await findCategory(anime!.title);
      if (results.length > 0) return results[0];

      // Try 2: remove season info, special chars
      const cleaned = anime!.title
        .replace(/season\s*\d+|s\d+/gi, "")
        .replace(/[!¡?¿.:;'"()]/g, "")
        .trim();
      if (cleaned !== anime!.title) {
        results = await findCategory(cleaned);
        if (results.length > 0) return results[0];
      }

      // Try 3: first 3 words
      const firstWords = anime!.title.split(" ").slice(0, 3).join(" ");
      if (firstWords !== cleaned) {
        results = await findCategory(firstWords);
        if (results.length > 0) return results[0];
      }

      // Try 4: first 2 words
      const twoWords = anime!.title.split(" ").slice(0, 2).join(" ");
      if (twoWords !== firstWords) {
        results = await findCategory(twoWords);
        if (results.length > 0) return results[0];
      }

      return null;
    },
    enabled: !!anime?.title,
  });
  if (!anime) return <p className="p-8 text-white/40">Loading…</p>;

  return (
    <div className="relative flex flex-col gap-4 px-4 pb-8 pt-8 sm:gap-6">
      <AuroraBackdrop tint={extras?.color ?? "#7C3AED"} />

      {/* ── Hero Card ── */}
      <section className="nb-card bg-ink-800 p-4 sm:p-5">
        <div className="flex gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={anime.cover}
            alt={anime.title}
            className="nb-border-thick h-56 w-40 shrink-0 rounded-xl object-cover"
          />
          <div className="flex flex-col justify-end gap-2">
            <h1 className="nb-heading nb-heading-xl font-black leading-tight">
              {anime.title}
            </h1>
            <p className="nb-tag w-fit text-accent-gold">
              <Star size={12} color="currentColor" fill="currentColor" className="mr-1" />
              {anime.score ?? "–"} · {anime.type ?? ""} · {anime.episodes ?? "?"} eps
            </p>
            <div className="flex flex-wrap gap-1.5">
              {anime.genres.slice(0, 4).map((g) => (
                <span key={g} className="nb-tag">
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <FavoriteButton anime={anime} />
          <ProgressControl anime={anime} maxEpisodes={anime.episodes} />
        </div>
      </section>

      {/* ── Synopsis Card ── */}
      {anime.description && (
        <section className="nb-card-accent bg-ink-800 p-4 sm:p-5" data-card-accent="stats">
          <h2 className="nb-heading nb-heading-sm mb-2">Synopsis</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">
            {htmlToText(anime.description)}
          </p>
        </section>
      )}

      {/* ── AI Panel ── */}
      <AiPanel anime={anime} />

      {/* ── Episodes Card ── */}
      <section className="nb-card-accent bg-ink-800 p-4 sm:p-5" data-card-accent="progress">
        <h2 className="nb-section-header">Episodes</h2>
        <EpisodeList malId={extras?.idMal ?? null} aniwatchCategoryId={aniwatchCat?.id} aniwatchCategoryName={aniwatchCat?.name} />
      </section>

      {/* ── Characters Row (transparent group — each card carries its own border) ── */}
      {!!chars?.length && (
        <section data-card-accent="characters">
          <Carousel title="Characters">
            {chars.map((c) => (
              <Link key={c.id} href={`/character/${c.id}`} className="block min-h-[44px]">
                <Card3D className="nb-card-accent-sm w-24 shrink-0 overflow-hidden rounded-xl bg-ink-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.image ?? ""} alt={c.name} className="aspect-[2/3] w-full object-cover" />
                  <p className="line-clamp-2 p-1 text-[10px] font-semibold">{c.name}</p>
                </Card3D>
              </Link>
            ))}
          </Carousel>
        </section>
      )}

      {/* ── Recommendations Row (transparent group — PosterCard already carries its own border) ── */}
      {!!recs?.length && (
        <section data-card-accent="recommend">
          <Carousel title="You Might Like">
            {recs.map((a) => (
              <PosterCard key={a.id} anime={a} />
            ))}
          </Carousel>
        </section>
      )}
    </div>
  );
}
