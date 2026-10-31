"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Play, Star, Tv, Clapperboard, Info } from "lucide-react";
import { getAnimeDetails, getCharacters, getRecommendations } from "@/lib/anime/anilist";
import { getAnimeExtras } from "@/lib/anime/anilist-extra";
import { findCategory } from "@/lib/anime/aniwatch";
import { htmlToText } from "@/lib/ui/htmlToText";
import { Carousel } from "@/components/ui/Carousel";
import { PosterCard } from "@/components/ui/PosterCard";
import { Card3D } from "@/components/ui/Card3D";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { ProgressControl } from "@/components/ui/ProgressControl";
import { AiPanel } from "@/components/screens/AiPanel";
import { EpisodeList } from "@/components/screens/EpisodeList";
import { SeasonSwitcher } from "@/components/screens/SeasonSwitcher";
import { Countdown } from "@/components/ui/Countdown";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function statusLabel(status: string | null): string | null {
  if (!status) return null;
  const map: Record<string, string> = {
    RELEASING: "Airing now",
    FINISHED: "Finished",
    NOT_YET_RELEASED: "Coming soon",
    CANCELLED: "Cancelled",
    HIATUS: "On hiatus",
  };
  return map[status] ?? status.replace(/_/g, " ").toLowerCase();
}

function CarouselSkeleton({ count = 6, wide = false }: { count?: number; wide?: boolean }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`skeleton shrink-0 ${wide ? "h-[168px] w-24" : "h-[190px] w-32"}`}
        />
      ))}
    </div>
  );
}

export function AnimeDetail({ id }: { id: number }) {
  const [storyOpen, setStoryOpen] = useState(false);
  const { data: anime, isLoading } = useQuery({
    queryKey: ["anime", id],
    queryFn: () => getAnimeDetails(id),
  });
  const chars = useQuery({ queryKey: ["chars", id], queryFn: () => getCharacters(id) });
  const recs = useQuery({ queryKey: ["recs", id], queryFn: () => getRecommendations(id) });
  const extras = useQuery({ queryKey: ["extras", id], queryFn: () => getAnimeExtras(id) });
  const aniwatchCat = useQuery({
    queryKey: ["aniwatch-cat", anime?.title],
    queryFn: async () => {
      let results = await findCategory(anime!.title);
      if (results.length > 0) return results[0];

      const cleaned = anime!.title
        .replace(/season\s*\d+|s\d+/gi, "")
        .replace(/[!¡?¿.:;'"()]/g, "")
        .trim();
      if (cleaned !== anime!.title) {
        results = await findCategory(cleaned);
        if (results.length > 0) return results[0];
      }

      const firstWords = anime!.title.split(" ").slice(0, 3).join(" ");
      if (firstWords !== cleaned) {
        results = await findCategory(firstWords);
        if (results.length > 0) return results[0];
      }

      const twoWords = anime!.title.split(" ").slice(0, 2).join(" ");
      if (twoWords !== firstWords) {
        results = await findCategory(twoWords);
        if (results.length > 0) return results[0];
      }

      return null;
    },
    enabled: !!anime?.title,
  });

  if (isLoading || !anime) {
    return (
      <div className="px-4 pb-10 pt-3">
        <div className="skeleton h-[300px] w-full rounded-3xl" />
        <div className="skeleton mt-3 h-[86px] w-full" />
        <div className="skeleton mt-3 h-14 w-full" />
        <div className="skeleton mt-3 h-40 w-full" />
      </div>
    );
  }

  const malId = extras.data?.idMal ?? null;
  const isMovie = anime.type === "MOVIE" || anime.episodes === 1;
  const watchQuery = new URLSearchParams({ audio: "sub" });
  if (malId) watchQuery.set("mal", String(malId));
  watchQuery.set("ep", "1");
  const watchHref = `/watch/${slugify(anime.title)}-episode-1?${watchQuery.toString()}`;
  const banner = anime.bannerImage || anime.banner || anime.cover;
  const story = anime.description ? htmlToText(anime.description) : "";
  const longStory = story.length > 320;
  const status = statusLabel(anime.status);
  const notAired = anime.status === "NOT_YET_RELEASED";

  return (
    <div className="flex flex-col gap-3 px-4 pb-10 pt-3">
      {/* ── Cinematic hero ───────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[28px] border border-nb-border bg-ink-800 shadow-[0_40px_80px_-46px_rgba(0,0,0,0.9)]">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={banner}
            alt=""
            className="h-full w-full scale-105 object-cover opacity-55"
            style={{ filter: "saturate(115%)" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--ink-solid)] via-[color:var(--ink-solid)]/78 to-[color:var(--ink-solid)]/15" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 0% 100%, color-mix(in oklab, var(--accent-purple) 24%, transparent), transparent 62%)",
            }}
          />
        </div>

        <div className="relative flex flex-col gap-4 p-4 pt-16 sm:p-6 sm:pt-24">
          <div className="flex items-end gap-3.5">
            <div className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={anime.cover}
                alt={anime.title}
                className="h-[148px] w-[104px] rounded-2xl border border-white/20 object-cover shadow-[0_24px_50px_-18px_rgba(0,0,0,0.95)] sm:h-[220px] sm:w-[156px]"
              />
              {anime.score != null && (
                <span className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-amber-300/30 bg-[color:var(--ink-900)]/90 px-2 py-1 text-[11px] font-black text-amber-300 shadow-lg backdrop-blur">
                  <Star size={10} fill="currentColor" /> {anime.score}
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {status && (
                  <span
                    className={`nb-tag ${
                      anime.status === "RELEASING"
                        ? "border-emerald-300/25 bg-emerald-400/12 text-emerald-300"
                        : notAired
                          ? "border-sky-300/25 bg-sky-400/12 text-sky-300"
                          : ""
                    }`}
                  >
                    {anime.status === "RELEASING" && (
                      <span className="mr-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-soft" />
                    )}
                    {status}
                  </span>
                )}
                {anime.type && <span className="nb-tag">{anime.type}</span>}
                {anime.seasonYear && <span className="nb-tag">{anime.seasonYear}</span>}
              </div>

              <h1 className="font-display text-[26px] font-bold leading-[1.05] tracking-tight sm:text-[40px]">
                {anime.title}
              </h1>

              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] font-semibold text-white/45">
                <span>
                  {anime.episodes
                    ? `${anime.episodes} episode${anime.episodes === 1 ? "" : "s"}`
                    : isMovie
                      ? "Feature film"
                      : "Episodes"}
                </span>
                {anime.studios.length > 0 && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-white/25" />
                    <span className="truncate">{anime.studios[0]}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {anime.nextAiringEpisode && (
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 backdrop-blur">
              <CalendarClock size={15} className="shrink-0 text-sky-300" />
              <p className="text-[12px] font-semibold text-white/70">
                Episode {anime.nextAiringEpisode.episode} airs{" "}
                <Countdown airingAt={anime.nextAiringEpisode.airingAt} />
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Link
              href={watchHref}
              prefetch={false}
              className="nb-btn nb-btn-accent nb-btn-lg min-h-[52px] flex-1"
            >
              <Play size={18} fill="currentColor" />
              {isMovie ? "Watch movie" : notAired ? "Preview episode 1" : "Watch episode 1"}
            </Link>
            <FavoriteButton anime={anime} iconOnly />
          </div>

          {anime.genres.length > 0 && (
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
              {anime.genres.slice(0, 8).map((genre) => (
                <span key={genre} className="nb-tag shrink-0">
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Seasons & related ────────────────────────────────── */}
      <SeasonSwitcher id={id} title={anime.title} />

      {/* ── Story ────────────────────────────────────────────── */}
      {story && (
        <section className="nb-card p-4">
          <div className="nb-section-header">
            <span className="flex items-center gap-2">
              <Info size={15} className="text-accent-blue" />
              Story
            </span>
          </div>
          <p
            className={`whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/65 ${
              !storyOpen && longStory ? "line-clamp-5" : ""
            }`}
          >
            {story}
          </p>
          {longStory && (
            <button
              type="button"
              onClick={() => setStoryOpen((v) => !v)}
              className="mt-2 text-[12px] font-bold text-accent-purple"
            >
              {storyOpen ? "Show less" : "Read more"}
            </button>
          )}
        </section>
      )}

      {/* ── Progress ─────────────────────────────────────────── */}
      <ProgressControl anime={anime} maxEpisodes={anime.episodes} />

      <AiPanel anime={anime} />

      {/* ── Episodes ─────────────────────────────────────────── */}
      <section id="episodes" className="nb-card p-4" data-card-accent="progress">
        <div className="nb-section-header">
          <span className="flex items-center gap-2">
            <Tv size={15} className="text-accent-purple" />
            {isMovie ? "Movie" : "Episodes"}
          </span>
          {anime.episodes ? (
            <span className="text-[11px] font-semibold tracking-normal text-white/35">
              {anime.episodes} total
            </span>
          ) : (
            <span className="text-[11px] font-semibold tracking-normal text-white/35">
              {notAired ? "Upcoming" : "Source list"}
            </span>
          )}
        </div>
        <EpisodeList
          malId={malId}
          animeTitle={anime.title}
          totalEpisodes={anime.episodes}
          aniwatchCategoryId={aniwatchCat.data?.id}
          aniwatchCategoryName={aniwatchCat.data?.name}
          animeStatus={anime.status}
          nextAiring={anime.nextAiringEpisode}
          fallbackHref={watchHref}
          isMovie={isMovie}
        />
      </section>

      {/* ── Characters ───────────────────────────────────────── */}
      <section data-card-accent="characters">
        <div className="nb-section-header">
          <span className="flex items-center gap-2">
            <Clapperboard size={15} className="text-accent-crimson" />
            Characters
          </span>
        </div>
        {chars.isLoading ? (
          <CarouselSkeleton count={6} wide />
        ) : chars.data && chars.data.length > 0 ? (
          <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
            {chars.data.map((c) => (
              <Link key={c.id} href={`/character/${c.id}`} className="block w-[92px] shrink-0">
                <Card3D className="overflow-hidden rounded-2xl border border-nb-border bg-ink-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.image ?? ""}
                    alt={c.name}
                    loading="lazy"
                    className="aspect-[2/3] w-full object-cover"
                  />
                  <p className="line-clamp-2 px-2 py-1.5 text-[10.5px] font-semibold leading-tight">
                    {c.name}
                  </p>
                </Card3D>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-white/12 px-3 py-6 text-center text-[12.5px] font-semibold text-white/40">
            No cast data for this title yet.
          </p>
        )}
      </section>

      {/* ── Recommendations ──────────────────────────────────── */}
      <section data-card-accent="recommend">
        <div className="nb-section-header">
          <span className="flex items-center gap-2">
            <Star size={15} className="text-accent-gold" />
            You might like
          </span>
        </div>
        {recs.isLoading ? (
          <CarouselSkeleton />
        ) : recs.data && recs.data.length > 0 ? (
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {recs.data.map((a) => (
              <PosterCard key={a.id} anime={a} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-white/12 px-3 py-6 text-center text-[12.5px] font-semibold text-white/40">
            No recommendations available.
          </p>
        )}
      </section>
    </div>
  );
}
