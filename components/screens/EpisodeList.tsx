"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Play, Search } from "lucide-react";
import { getEpisodesByMal } from "@/lib/anime/jikan";
import { fetchEpisodesByCategory } from "@/lib/anime/aniwatch";
import type { AniwatchEpisode } from "@/lib/anime/aniwatch-types";
import { useDebounce } from "@/lib/ui/useDebounce";
import { Countdown } from "@/components/ui/Countdown";

const RANGE_SIZE = 100;

type EpisodeListProps = {
  malId: number | null;
  animeTitle: string;
  totalEpisodes?: number | null;
  aniwatchCategoryId?: number;
  aniwatchCategoryName?: string;
  animeStatus?: string | null;
  nextAiring?: { episode: number; airingAt: number } | null;
  /** Where "just play episode 1" should go when no list exists. */
  fallbackHref?: string;
  isMovie?: boolean;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function watchHref(opts: {
  slug: string;
  malId?: number | null;
  episode?: number;
  audio?: "sub" | "dub";
}): string {
  const params = new URLSearchParams();
  if (opts.malId) params.set("mal", String(opts.malId));
  if (opts.episode && opts.episode > 0) params.set("ep", String(opts.episode));
  if (opts.audio) params.set("audio", opts.audio);
  const query = params.toString();
  return `/watch/${opts.slug}${query ? `?${query}` : ""}`;
}

function episodeNumberFromAniwatch(ep: AniwatchEpisode): number | null {
  const fromSlug = ep.slug.match(/-episode-(\d+)/i);
  if (fromSlug) return Number(fromSlug[1]);
  const fromTitle = ep.title.match(/episode\s*(\d+)/i);
  if (fromTitle) return Number(fromTitle[1]);
  return null;
}

function cleanAniwatchTitle(title: string): string {
  const cleaned = title
    .replace(/^\s*\[[^\]]*\]\s*/, "")
    .replace(/\s*[-–|]\s*episode\s*\d+.*$/i, "")
    .replace(/\s*episode\s*\d+.*$/i, "")
    .replace(/\s*(english\s*)?(subbed|dubbed|sub|dub).*$/i, "")
    .replace(/\s*\((?:sub|dub|hd|fhd|360p|480p|720p|1080p)\)\s*$/i, "")
    .trim();
  return cleaned || title;
}

function audioFromAniwatch(ep: AniwatchEpisode): "sub" | "dub" {
  return /dub(bed)?/i.test(`${ep.slug} ${ep.title}`) ? "dub" : "sub";
}

function RowSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton h-[54px] w-full rounded-xl" />
      ))}
    </div>
  );
}

export function EpisodeList({
  malId,
  animeTitle,
  totalEpisodes,
  aniwatchCategoryId,
  aniwatchCategoryName,
  animeStatus,
  nextAiring,
  fallbackHref,
  isMovie,
}: EpisodeListProps) {
  const [rangeStart, setRangeStart] = useState(0);
  const [term, setTerm] = useState("");
  const debouncedTerm = useDebounce(term, 200);

  const jikan = useQuery({
    queryKey: ["episodes", malId],
    queryFn: () => getEpisodesByMal(malId as number),
    enabled: malId != null,
    retry: 1,
  });

  const aniwatch = useQuery({
    queryKey: ["aniwatch-episodes", aniwatchCategoryId],
    queryFn: () => fetchEpisodesByCategory(aniwatchCategoryId as number),
    enabled: aniwatchCategoryId != null,
    retry: 1,
  });

  const episodes = useMemo(() => {
    if (jikan.data?.length) return jikan.data;
    if (!totalEpisodes || totalEpisodes < 1) return [];
    const count = Math.min(totalEpisodes, 2000);
    return Array.from({ length: count }, (_, index) => ({
      number: index + 1,
      title: count === 1 ? "Movie" : null,
      filler: false,
    }));
  }, [jikan.data, totalEpisodes]);

  const aniwatchEpisodes = useMemo(() => aniwatch.data ?? [], [aniwatch.data]);

  const ranges = useMemo(() => {
    if (episodes.length <= RANGE_SIZE) return [];
    const result: { start: number; end: number }[] = [];
    for (let i = 0; i < episodes.length; i += RANGE_SIZE) {
      result.push({ start: i, end: Math.min(i + RANGE_SIZE, episodes.length) });
    }
    return result;
  }, [episodes.length]);

  const rangedEpisodes = useMemo(() => {
    if (ranges.length === 0) return episodes;
    const active = ranges[rangeStart] ?? ranges[0];
    return episodes.slice(active.start, active.end);
  }, [episodes, ranges, rangeStart]);

  const query = debouncedTerm.trim().toLowerCase();

  const filteredEpisodes = useMemo(() => {
    if (!query) return rangedEpisodes;
    return rangedEpisodes.filter(
      (ep) => String(ep.number).includes(query) || (ep.title ?? "").toLowerCase().includes(query),
    );
  }, [rangedEpisodes, query]);

  const filteredAniwatch = useMemo(() => {
    if (!query) return aniwatchEpisodes;
    return aniwatchEpisodes.filter((ep) => {
      const number = episodeNumberFromAniwatch(ep);
      if (number != null && String(number).includes(query)) return true;
      return ep.title.toLowerCase().includes(query);
    });
  }, [aniwatchEpisodes, query]);

  const hasJikan = malId != null;
  const hasAniwatch = aniwatchCategoryId != null;
  const busy = jikan.isLoading || (jikan.isFetching && episodes.length === 0);
  const nothingAtAll = episodes.length === 0 && aniwatchEpisodes.length === 0;
  const notAired = animeStatus === "NOT_YET_RELEASED";
  const baseSlug = slugify(animeTitle);

  /* ── Nothing anywhere: never render an empty box ───────────── */
  if (nothingAtAll && !busy) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-white/12 bg-white/[0.06]">
          <CalendarClock size={19} className={notAired ? "text-sky-300" : "text-white/50"} />
        </span>
        <p className="mt-2.5 font-display text-[14.5px] font-bold">
          {notAired ? "This season has not started yet" : "No episode list for this title"}
        </p>
        <p className="mx-auto mt-1 max-w-[300px] text-[12px] leading-snug text-white/45">
          {notAired
            ? nextAiring
              ? `Episode ${nextAiring.episode} airs `
              : "Episodes will appear here as soon as they air."
            : "The episode source is empty right now, but playback is still worth a try."}
          {notAired && nextAiring && <Countdown airingAt={nextAiring.airingAt} />}
        </p>
        {fallbackHref && (
          <Link
            href={fallbackHref}
            prefetch={false}
            className="nb-btn nb-btn-accent mt-3 w-full justify-center"
          >
            <Play size={15} fill="currentColor" />
            {notAired ? "Try episode 1" : "Play episode 1 anyway"}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      {hasJikan && (
        <>
          {ranges.length > 0 && (
            <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {ranges.map((range, i) => (
                <button
                  key={range.start}
                  type="button"
                  onClick={() => setRangeStart(i)}
                  className={`shrink-0 rounded-xl border px-3 py-1.5 text-[11.5px] font-bold transition-colors ${
                    i === rangeStart
                      ? "border-transparent bg-gradient-to-br from-[color:var(--accent-purple)] to-[color:var(--accent-blue)] text-white"
                      : "border-white/12 bg-white/[0.05] text-white/60 hover:bg-white/[0.09]"
                  }`}
                >
                  {range.start + 1}–{range.end}
                </button>
              ))}
            </div>
          )}

          <label className="relative mb-3 block">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35"
            />
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={isMovie ? "Find the movie…" : "Find episode number or title…"}
              inputMode="search"
              className="nb-input pl-10"
              style={{ minHeight: 46 }}
            />
          </label>

          {busy && <RowSkeleton />}

          {!busy && filteredEpisodes.length === 0 && (
            <p className="py-5 text-center text-[12.5px] font-semibold text-white/45">
              {query ? "No episode matches that search." : "No episodes found."}
            </p>
          )}

          {!busy && filteredEpisodes.length > 0 && (
            <div className="flex flex-col gap-2">
              {filteredEpisodes.map((ep) => {
                const row = (
                  <div className="flex min-h-[54px] items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 transition-colors hover:border-white/20 hover:bg-white/[0.08]">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <span className="grid h-9 w-12 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-[11px] font-black text-accent-purple">
                        {isMovie ? "MOV" : `EP ${ep.number}`}
                      </span>
                      <span className="line-clamp-1 min-w-0 flex-1 text-[13px] font-semibold text-white/85">
                        {ep.title ?? (isMovie ? "Full movie" : `Episode ${ep.number}`)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {ep.filler && (
                        <span className="hidden rounded-full border border-amber-300/25 bg-amber-300/12 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-300 sm:inline">
                          Filler
                        </span>
                      )}
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[color:var(--accent-purple)] to-[color:var(--accent-blue)] text-white shadow-[0_10px_22px_-12px_rgba(139,92,246,0.95)]">
                        <Play size={13} fill="currentColor" />
                      </span>
                    </div>
                  </div>
                );

                return ep.number > 0 ? (
                  <Link
                    key={`jikan-${ep.number}`}
                    href={watchHref({
                      slug: `${baseSlug}-episode-${ep.number}`,
                      malId,
                      episode: ep.number,
                    })}
                    className="block"
                    prefetch={false}
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={`jikan-${ep.number}`}>{row}</div>
                );
              })}
            </div>
          )}
        </>
      )}

      {hasAniwatch && (
        <>
          {hasJikan && (
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/12" />
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/35">
                {aniwatchCategoryName ? `Latest from ${aniwatchCategoryName}` : "Latest from source"}
              </span>
              <div className="h-px flex-1 bg-white/12" />
            </div>
          )}

          <div className="flex flex-col gap-2">
            {(aniwatch.isLoading || aniwatch.isFetching) && filteredAniwatch.length === 0 ? (
              <RowSkeleton />
            ) : filteredAniwatch.length === 0 ? (
              <p className="py-5 text-center text-[12.5px] font-semibold text-white/40">
                No source episodes found right now.
              </p>
            ) : (
              filteredAniwatch.map((ep) => {
                const number = episodeNumberFromAniwatch(ep);
                const audio = audioFromAniwatch(ep);
                return (
                  <Link
                    key={ep.id}
                    href={watchHref({
                      slug: ep.slug,
                      malId,
                      episode: number ?? undefined,
                      audio,
                    })}
                    className="flex min-h-[54px] items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 transition-colors hover:border-white/20 hover:bg-white/[0.08]"
                    prefetch={false}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <span className="grid h-9 w-12 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-[11px] font-black text-accent-blue">
                        {number ? `EP ${number}` : "NEW"}
                      </span>
                      <span className="line-clamp-1 min-w-0 flex-1 text-[13px] font-semibold text-white/85">
                        {cleanAniwatchTitle(ep.title)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full border border-sky-300/25 bg-sky-400/12 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-sky-300">
                        {audio}
                      </span>
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/12 text-white">
                        <Play size={13} fill="currentColor" />
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </>
      )}

      {!hasJikan && !hasAniwatch && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <p className="font-display text-[14px] font-bold">No episode data for this title</p>
          <p className="mt-1 text-[12px] text-white/45">
            Try another title from search, or check back when it airs.
          </p>
          {fallbackHref && (
            <Link
              href={fallbackHref}
              prefetch={false}
              className="nb-btn nb-btn-accent mt-3 w-full justify-center"
            >
              <Play size={15} fill="currentColor" />
              Try episode 1
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
