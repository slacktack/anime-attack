"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, Play, Search, X } from "lucide-react";
import { getEpisodesByMal } from "@/lib/anime/jikan";
import { fetchEpisodesByCategory } from "@/lib/anime/aniwatch";
import type { AniwatchEpisode } from "@/lib/anime/aniwatch-types";
import { useDebounce } from "@/lib/ui/useDebounce";
import { Countdown } from "@/components/ui/Countdown";

const PAGE_SIZE = 60;

type EpisodeListProps = {
  malId: number | null;
  animeTitle: string;
  totalEpisodes?: number | null;
  aniwatchCategoryId?: number;
  aniwatchCategoryName?: string;
  animeStatus?: string | null;
  nextAiring?: { episode: number; airingAt: number } | null;
  fallbackHref?: string;
  isMovie?: boolean;
  /** Highest episode the user has watched (spoiler ceiling) for the "you are here" mark. */
  resumeEpisode?: number;
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

function GridSkeleton({ count = 24 }: { count?: number }) {
  return (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton aspect-square rounded-xl" />
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
  resumeEpisode = 0,
}: EpisodeListProps) {
  const [page, setPage] = useState(0);
  const [term, setTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [jump, setJump] = useState("");
  const debouncedTerm = useDebounce(term, 200);
  const router = useRouter();

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
  const query = debouncedTerm.trim().toLowerCase();

  const chunks = useMemo(() => {
    if (episodes.length <= PAGE_SIZE) return [];
    const result: { start: number; end: number }[] = [];
    for (let i = 0; i < episodes.length; i += PAGE_SIZE) {
      result.push({ start: i, end: Math.min(i + PAGE_SIZE, episodes.length) });
    }
    return result;
  }, [episodes.length]);

  const visible = useMemo(() => {
    if (!query) {
      if (chunks.length === 0) return episodes;
      const active = chunks[page] ?? chunks[0];
      return episodes.slice(active.start, active.end);
    }
    return episodes.filter(
      (ep) => String(ep.number).includes(query) || (ep.title ?? "").toLowerCase().includes(query),
    );
  }, [episodes, chunks, page, query]);

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
              : "Episodes appear here as soon as they air."
            : "The source list is empty right now, but playback is still worth a try."}
          {notAiring(nextAiring, notAired)}
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

  if (busy && episodes.length === 0) return <GridSkeleton />;

  /* ── Single-entry titles (movies, one-shots) ───────────────── */
  if (isMovie && !query) {
    return (
      <Link
        href={watchHref({ slug: `${baseSlug}-episode-1`, malId, episode: 1 })}
        prefetch={false}
        className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.05] p-3 transition-colors hover:bg-white/[0.09]"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[color:var(--accent-purple)] to-[color:var(--accent-blue)] text-white">
          <Play size={18} fill="currentColor" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[14px] font-bold">Play the movie</span>
          <span className="block text-[11.5px] font-semibold text-white/40">
            Full feature · sub and dub
          </span>
        </span>
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Toolbar: jump-to-episode + range select + search */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const target = Number(jump);
          if (!Number.isInteger(target) || target < 1) return;
          const max = episodes.length || totalEpisodes || target;
          const ep = Math.min(target, Math.max(1, max));
          router.push(
            watchHref({ slug: `${baseSlug}-episode-${ep}`, malId, episode: ep }),
          );
        }}
        className="flex items-center gap-1.5"
      >
        <div className="relative min-w-0 flex-1">
          <input
            value={jump}
            onChange={(event) => setJump(event.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            aria-label="Jump to episode number"
            placeholder={`Episode 1–${episodes.length || totalEpisodes || "?"}`}
            className="nb-input pr-12"
            style={{ minHeight: 42, fontSize: 13 }}
          />
          <button
            type="submit"
            aria-label="Jump"
            className="absolute right-1 top-1/2 grid h-8 w-9 -translate-y-1/2 place-items-center rounded-lg bg-gradient-to-br from-[color:var(--accent-purple)] to-[color:var(--accent-blue)] text-white"
          >
            <ArrowRight size={14} />
          </button>
        </div>

        {chunks.length > 0 && !query && (
          <select
            value={page}
            onChange={(event) => setPage(Number(event.target.value))}
            aria-label="Episode range"
            className="nb-input shrink-0"
            style={{ minHeight: 42, fontSize: 12, width: 96, paddingRight: 26 }}
          >
            {chunks.map((chunk, i) => (
              <option key={chunk.start} value={i}>
                {chunk.start + 1}–{chunk.end}
              </option>
            ))}
          </select>
        )}

        {episodes.length > 12 && (
          <button
            type="button"
            onClick={() => {
              setSearchOpen((v) => !v);
              setTerm("");
            }}
            aria-label={searchOpen ? "Close episode search" : "Search episodes by title"}
            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border border-white/12 bg-white/[0.05] text-white/60"
          >
            {searchOpen ? <X size={15} /> : <Search size={15} />}
          </button>
        )}
      </form>

      {searchOpen && (
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Episode number or title…"
          inputMode="search"
          autoFocus
          className="nb-input"
          style={{ minHeight: 40, fontSize: 13 }}
        />
      )}

      {/* Episode number grid */}
      {visible.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] font-semibold text-white/45">
          {query ? "No episode matches that search." : "No episodes found."}
        </p>
      ) : (
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
          {visible.map((ep) => {
            const isResume = resumeEpisode > 0 && ep.number === resumeEpisode;
            return (
              <Link
                key={`ep-${ep.number}`}
                href={watchHref({
                  slug: `${baseSlug}-episode-${ep.number}`,
                  malId,
                  episode: ep.number,
                })}
                prefetch={false}
                title={ep.title ?? `Episode ${ep.number}`}
                className={`relative grid aspect-square place-items-center rounded-xl border text-[12.5px] font-bold tabular-nums transition-all active:scale-95 ${
                  isResume
                    ? "border-transparent bg-gradient-to-br from-[color:var(--accent-purple)] to-[color:var(--accent-blue)] text-white shadow-[0_10px_22px_-14px_rgba(139,92,246,0.95)]"
                    : "border-white/10 bg-white/[0.05] text-white/75 hover:border-white/25 hover:bg-white/[0.11] hover:text-white"
                }`}
              >
                {ep.number}
                {ep.filler && (
                  <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-amber-300" />
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Latest from source (background episodes land here) */}
      {hasAniwatch && filteredAniwatch.length > 0 && (
        <details className="mt-1 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
          <summary className="cursor-pointer text-[11px] font-black uppercase tracking-[0.1em] text-white/40">
            {aniwatchCategoryName ? `Latest from ${aniwatchCategoryName}` : "Latest from source"} ·{" "}
            {filteredAniwatch.length}
          </summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {filteredAniwatch.slice(0, 40).map((ep) => {
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
                  prefetch={false}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.04] px-2.5 py-2"
                >
                  <span className="line-clamp-1 min-w-0 flex-1 text-[12px] font-semibold text-white/75">
                    {cleanAniwatchTitle(ep.title)}
                  </span>
                  <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white/60">
                    {audio}
                  </span>
                </Link>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

/** Small helper so the "airs in" countdown only renders when it makes sense. */
function notAiring(
  nextAiring: { episode: number; airingAt: number } | null | undefined,
  notAired: boolean,
) {
  if (!notAired || !nextAiring) return null;
  return <Countdown airingAt={nextAiring.airingAt} />;
}
