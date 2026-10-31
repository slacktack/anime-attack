"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Play, Star } from "lucide-react";
import { fetchAnimeDetail } from "@/lib/client/api";
import { findCategory } from "@/lib/anime/aniwatch";
import { htmlToText } from "@/lib/ui/htmlToText";
import { PosterCard } from "@/components/ui/PosterCard";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { ProgressControl } from "@/components/ui/ProgressControl";
import { AiPanel } from "@/components/screens/AiPanel";
import { getSpoilerCeiling } from "@/lib/storage/store";
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
  const [tab, setTab] = useState<"episodes" | "more" | "about" | "ai">("episodes");
  const [resumeEpisode, setResumeEpisode] = useState(0);

  useEffect(() => setResumeEpisode(getSpoilerCeiling(id)), [id]);

  const detail = useQuery({
    queryKey: ["anime-detail", id],
    queryFn: () => fetchAnimeDetail(id),
    staleTime: 5 * 60 * 1000,
  });
  const anime = detail.data?.anime;
  const isLoading = detail.isLoading;
  const chars = { data: detail.data?.characters, isLoading: detail.isLoading };
  const recs = { data: detail.data?.recommendations, isLoading: detail.isLoading };
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

  // Give the tab a real title (the route is a dynamic segment with no metadata).
  useEffect(() => {
    if (!anime?.title) return;
    const previous = document.title;
    document.title = `${anime.title} · Anime Attack`;
    return () => {
      document.title = previous;
    };
  }, [anime?.title]);

  if (isLoading || !anime) {
    return (
      <div className="pb-16">
        <div className="skeleton h-[62svh] min-h-[460px] w-full rounded-none lg:h-[min(78vh,46vw)]" />
        <div className="aa-gutter mt-6 flex flex-col gap-3">
          <div className="skeleton h-10 w-72" />
          <div className="skeleton h-40 w-full" />
        </div>
      </div>
    );
  }

  const malId = detail.data?.malId ?? null;
  const isMovie = anime.type === "MOVIE" || anime.episodes === 1;
  const startEp = Math.max(1, resumeEpisode);
  const watchQuery = new URLSearchParams({ audio: "sub" });
  if (malId) watchQuery.set("mal", String(malId));
  watchQuery.set("ep", String(startEp));
  const watchHref = `/watch/${slugify(anime.title)}-episode-${startEp}?${watchQuery.toString()}`;
  const banner = anime.bannerImage || anime.banner || anime.cover;
  const story = anime.description ? htmlToText(anime.description) : "";
  const status = statusLabel(anime.status);
  const notAired = anime.status === "NOT_YET_RELEASED";
  const playLabel = isMovie
    ? "Play movie"
    : resumeEpisode > 0
      ? `Resume episode ${startEp}`
      : notAired
        ? "Preview episode 1"
        : "Play episode 1";

  const tabs = [
    ["episodes", isMovie ? "Watch" : "Episodes"],
    ["more", "More like this"],
    ["about", "Story & cast"],
    ["ai", "AI recap"],
  ] as const;

  return (
    <div className="pb-16">
      {/* billboard */}
      <section className="on-media relative h-[64svh] min-h-[480px] w-full overflow-hidden bg-black lg:h-[min(80vh,46vw)] lg:min-h-[560px]">
        <picture className="absolute inset-0">
          <source media="(min-width: 1024px)" srcSet={banner} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={anime.cover} alt="" className="aa-xfade h-full w-full object-cover object-[50%_22%]" />
        </picture>
        <div className="absolute inset-0 hidden bg-[linear-gradient(77deg,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.6)_32%,transparent_66%)] lg:block" />
        <div className="absolute inset-x-0 bottom-0 h-[70%] bg-[linear-gradient(to_top,var(--ink-solid)_0%,color-mix(in_oklab,var(--ink-solid)_80%,transparent)_32%,transparent_100%)] lg:h-[45%]" />

        <div className="aa-gutter absolute inset-x-0 bottom-0 pb-7 lg:pb-14">
          <div className="flex max-w-[720px] flex-col">
            <h1
              className={`aa-billboard-title line-clamp-3 text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)] ${
                anime.title.length > 44
                  ? "text-[34px] sm:text-[46px] lg:text-[clamp(46px,4vw,68px)]"
                  : "text-[44px] sm:text-[58px] lg:text-[clamp(60px,5.6vw,104px)]"
              }`}
            >
              {anime.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] font-medium text-white/80 lg:text-[15px]">
              {anime.score != null && (
                <span className="flex items-center gap-1 font-bold text-accent-gold">
                  <Star size={14} fill="currentColor" /> {anime.score.toFixed(1)}
                </span>
              )}
              {status && (
                <span
                  className={`font-semibold ${
                    anime.status === "RELEASING" ? "text-emerald-400" : notAired ? "text-sky-300" : ""
                  }`}
                >
                  {status}
                </span>
              )}
              {anime.seasonYear && <span>{anime.seasonYear}</span>}
              {anime.type && <span>{anime.type === "MOVIE" ? "Movie" : anime.type}</span>}
              {anime.episodes != null && anime.episodes > 1 && <span>{anime.episodes} episodes</span>}
              {anime.studios[0] && <span className="text-white/60">{anime.studios[0]}</span>}
            </div>

            {anime.genres.length > 0 && (
              <p className="mt-2 text-[13.5px] text-white/65">{anime.genres.slice(0, 5).join("  •  ")}</p>
            )}

            {story && (
              <p className="mt-4 hidden max-w-[60ch] text-[15px] leading-relaxed text-white/80 lg:line-clamp-3">
                {story.replace(/\s+/g, " ")}
              </p>
            )}

            <div className="mt-5 flex items-center gap-2.5 lg:gap-3">
              <Link
                href={watchHref}
                prefetch={false}
                className="aa-cta flex-1 sm:flex-none lg:min-h-[52px] lg:px-8 lg:text-[17px]"
              >
                <Play size={20} fill="currentColor" />
                {playLabel}
              </Link>
              <FavoriteButton anime={anime} iconOnly />
            </div>

            {anime.nextAiringEpisode && (
              <p className="mt-4 flex items-center gap-2 text-[13.5px] font-medium text-white/75">
                <CalendarClock size={15} className="shrink-0 text-sky-300" />
                Episode {anime.nextAiringEpisode.episode} airs <Countdown airingAt={anime.nextAiringEpisode.airingAt} />
              </p>
            )}
          </div>
        </div>
      </section>

      {/* tabs */}
      <div className="sticky top-[calc(var(--header-h)+env(safe-area-inset-top))] z-30 border-b border-[var(--glass-border)] bg-ink-solid/95 backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)]">
        <div role="tablist" className="aa-gutter no-scrollbar flex gap-6 overflow-x-auto lg:gap-9">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              onClick={() => setTab(key)}
              aria-selected={tab === key}
              className={`relative shrink-0 py-3.5 text-[14.5px] font-semibold transition-colors lg:text-[15.5px] ${
                tab === key ? "text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              {label}
              {tab === key && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t bg-accent-purple" />}
            </button>
          ))}
        </div>
      </div>

      <div className="aa-gutter pt-6 lg:pt-8">
        {tab === "episodes" && (
          <section id="episodes" className="flex flex-col gap-4">
            <SeasonSwitcher id={id} title={anime.title} year={anime.seasonYear} type={anime.type} />
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
              resumeEpisode={resumeEpisode}
            />
          </section>
        )}

        {tab === "more" && (
          <section>
            {recs.isLoading ? (
              <CarouselSkeleton />
            ) : recs.data && recs.data.length > 0 ? (
              <div className="grid grid-cols-3 gap-x-2.5 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
                {recs.data.map((a) => (
                  <PosterCard key={a.id} anime={a} fluid />
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-[14px] text-muted">No recommendations for this title yet.</p>
            )}
          </section>
        )}

        {tab === "about" && (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex flex-col gap-8">
              {story && (
                <section>
                  <h2 className="aa-section-title mb-3">Story</h2>
                  <p className="max-w-[72ch] whitespace-pre-wrap text-[15px] leading-relaxed text-white/75">{story}</p>
                </section>
              )}
              <section>
                <h2 className="aa-section-title mb-3">Characters</h2>
                {chars.isLoading ? (
                  <CarouselSkeleton count={5} wide />
                ) : chars.data && chars.data.length > 0 ? (
                  <div className="grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                    {chars.data.map((c) => (
                      <Link key={c.id} href={`/character/${c.id}`} className="group block">
                        <div className="poster-frame aspect-[2/3]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.image ?? ""} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                        </div>
                        <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-white/85 group-hover:text-white">
                          {c.name}
                        </p>
                        {c.role && <p className="text-[12px] capitalize text-muted">{c.role.toLowerCase()}</p>}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-[14px] text-muted">No cast data for this title yet.</p>
                )}
              </section>
            </div>
            <aside className="flex flex-col gap-6 text-[14px]">
              <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-3">
                {anime.studios.length > 0 && (
                  <>
                    <dt className="text-muted">Studio</dt>
                    <dd className="font-medium">{anime.studios.join(", ")}</dd>
                  </>
                )}
                {status && (
                  <>
                    <dt className="text-muted">Status</dt>
                    <dd className="font-medium">{status}</dd>
                  </>
                )}
                {anime.episodes != null && (
                  <>
                    <dt className="text-muted">Episodes</dt>
                    <dd className="font-medium">{anime.episodes}</dd>
                  </>
                )}
                {anime.genres.length > 0 && (
                  <>
                    <dt className="text-muted">Genres</dt>
                    <dd className="font-medium">{anime.genres.join(", ")}</dd>
                  </>
                )}
              </dl>
              <ProgressControl anime={anime} maxEpisodes={anime.episodes} />
            </aside>
          </div>
        )}

        {tab === "ai" && (
          <div className="max-w-4xl">
            <AiPanel anime={anime} />
          </div>
        )}
      </div>
    </div>
  );
}
