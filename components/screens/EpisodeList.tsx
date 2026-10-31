"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, Play, Search, X } from "lucide-react";
import { fetchEpisodeMeta, fetchWatchEpisodes } from "@/lib/client/api";
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
  /** Narrow list layout for the watch sidebar. */
  compact?: boolean;
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

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2 lg:grid-cols-[repeat(auto-fill,minmax(76px,1fr))]";

function GridSkeleton({ count = 24 }: { count?: number }) {
  return (
    <div className={GRID}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton h-12 rounded-lg" />
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
  compact = false,
}: EpisodeListProps) {
  const [page, setPage] = useState(0);
  const [term, setTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [jump, setJump] = useState("");
  const debouncedTerm = useDebounce(term, 200);
  const router = useRouter();

  // Server route (Jikan with a timeout + generated fallback); shares cache with WatchView.
  const jikan = useQuery({
    queryKey: ["watch-shelf", malId],
    queryFn: () => fetchWatchEpisodes(malId as number),
    enabled: malId != null,
    staleTime: 10 * 60 * 1000,
    retry: 1,
    // filler flags only exist in real Jikan data
    select: (d) => (d.source === "jikan" ? d.episodes : d.episodes.map((e) => ({ ...e, filler: false }))),
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
  const rangeFrom = visible[0]?.number ?? 1;
  const rangeTo = visible[visible.length - 1]?.number ?? rangeFrom;
  const meta = useQuery({
    queryKey: ["episode-meta", malId, rangeFrom, rangeTo],
    queryFn: () => fetchEpisodeMeta(malId as number, rangeFrom, rangeTo),
    enabled: malId != null && visible.length > 1 && !query,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const metaMap = useMemo(() => new Map((meta.data ?? []).map((m) => [m.number, m])), [meta.data]);
  const hasThumbs = (meta.data ?? []).some((m) => m.thumbnail || m.title);
  const hasTitles = episodes.some((ep) => ep.title && ep.title !== "Movie");

  // keep the playing episode in view inside the desktop sidebar
  useEffect(() => {
    if (!compact || !window.matchMedia("(min-width: 1280px)").matches) return;
    const el = document.querySelector<HTMLElement>("[data-ep-current]");
    const box = el?.closest("aside");
    if (el && box) box.scrollTop = el.offsetTop - box.clientHeight / 2;
  }, [compact, hasThumbs, resumeEpisode]);
  const airedUpTo = nextAiring && nextAiring.episode > 1 ? nextAiring.episode - 1 : null;

  if (nothingAtAll && !busy) {
    return (
      <div className="mx-auto max-w-md py-8 text-center">
        <CalendarClock size={26} className={`mx-auto ${notAired ? "text-sky-300" : "text-white/50"}`} />
        <p className="mt-3 font-display text-[18px] font-bold">
          {notAired ? "This season has not started yet" : "No episode list for this title"}
        </p>
        <p className="mx-auto mt-1.5 max-w-[340px] text-[14px] leading-snug text-muted">
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
            className="aa-cta mt-5"
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
        className="aa-card aa-card-raise flex max-w-xl items-center gap-4 p-4"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-black">
          <Play size={22} fill="currentColor" className="ml-0.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[17px] font-bold">Play the movie</span>
          <span className="block text-[13px] text-muted">Full feature, sub or dub</span>
        </span>
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-4">
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
        className="flex items-center gap-2"
      >
        <div className="relative min-w-0 flex-1 sm:max-w-[260px]">
          <input
            value={jump}
            onChange={(event) => setJump(event.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            aria-label="Jump to episode number"
            placeholder={`Episode 1–${episodes.length || totalEpisodes || "?"}`}
            className="nb-input pr-12"
            style={{ minHeight: 44 }}
          />
          <button
            type="submit"
            aria-label="Jump"
            className="absolute right-1.5 top-1/2 grid h-8 w-9 -translate-y-1/2 place-items-center rounded-md bg-white/12 text-white transition-colors hover:bg-white/20"
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
            style={{ minHeight: 44, width: 120, paddingRight: 30 }}
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
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-white/12 text-white/70 transition-colors hover:text-white"
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
          style={{ minHeight: 44 }}
        />
      )}

      {/* Episode number grid */}
      {visible.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] font-semibold text-white/45">
          {query ? "No episode matches that search." : "No episodes found."}
        </p>
      ) : (
        <div
          className={
            hasThumbs
              ? compact
                ? "flex flex-col gap-1.5"
                : "grid grid-cols-1 gap-x-3 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
              : hasTitles
                ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
                : GRID
          }
        >
          {visible.map((ep) => {
            const isResume = resumeEpisode > 0 && ep.number === resumeEpisode;
            const upcoming = airedUpTo != null && ep.number > airedUpTo;
            if (hasThumbs) {
              const m = metaMap.get(ep.number);
              const title = ep.title || m?.title || `Episode ${ep.number}`;
              const href = watchHref({ slug: `${baseSlug}-episode-${ep.number}`, malId, episode: ep.number });
              const thumb = (
                <span
                  className={`relative block aspect-video shrink-0 overflow-hidden rounded-md bg-ink-700 ${
                    compact ? "w-[124px]" : "w-full"
                  } ${isResume ? "ring-2 ring-accent-purple" : ""}`}
                >
                  {m?.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbnail} alt="" loading="lazy" className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${upcoming ? "opacity-30 grayscale" : ""}`} />
                  )}
                  {!upcoming && (
                    <span className="on-media absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-white/95 text-black">
                        <Play size={16} fill="currentColor" className="ml-0.5" />
                      </span>
                    </span>
                  )}
                  {isResume && (
                    <span className="on-media absolute left-1.5 top-1.5 rounded-[4px] bg-accent-purple px-1.5 py-0.5 text-[10.5px] font-bold text-white">
                      {compact ? "Now" : "Watching"}
                    </span>
                  )}
                </span>
              );
              const text = (
                <span className="min-w-0">
                  <span className={`line-clamp-2 font-semibold leading-snug ${compact ? "text-[13px]" : "text-[14px]"}`}>
                    <span className="text-muted">{ep.number}. </span>
                    {title}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    {upcoming ? "Not aired yet" : m?.airdate ? new Date(m.airdate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                    {ep.filler && <span className="ml-2 font-semibold text-amber-300">Filler</span>}
                  </span>
                </span>
              );
              const cls = compact
                ? `group flex items-center gap-3 rounded-lg p-1.5 transition-colors ${isResume ? "bg-white/10" : "hover:bg-white/5"}`
                : "group flex flex-col gap-2";
              return upcoming ? (
                <span key={`ep-${ep.number}`} className={`${cls} cursor-default opacity-60`}>
                  {thumb}
                  {text}
                </span>
              ) : (
                <Link key={`ep-${ep.number}`} href={href} prefetch={false} className={cls} data-ep-current={isResume || undefined}>
                  {thumb}
                  {text}
                </Link>
              );
            }
            if (upcoming) {
              return (
                <span
                  key={`ep-${ep.number}`}
                  title={`Episode ${ep.number} hasn't aired yet`}
                  className={`flex items-center justify-center rounded-lg border border-dashed border-white/10 text-[14px] font-semibold tabular-nums text-white/25 ${
                    hasTitles ? "h-14 justify-start gap-3 px-4" : "h-12"
                  }`}
                >
                  {ep.number}
                  {hasTitles && <span className="text-[13px] font-medium">Not aired yet</span>}
                </span>
              );
            }
            if (hasTitles) {
              return (
                <Link
                  key={`ep-${ep.number}`}
                  href={watchHref({ slug: `${baseSlug}-episode-${ep.number}`, malId, episode: ep.number })}
                  prefetch={false}
                  className={`group flex h-14 items-center gap-3 rounded-lg px-4 transition-colors ${
                    isResume ? "bg-white text-black" : "bg-ink-800 hover:bg-ink-700"
                  }`}
                >
                  <span className={`w-8 shrink-0 font-display text-[18px] font-bold tabular-nums ${isResume ? "" : "text-white/45 group-hover:text-white"}`}>
                    {ep.number}
                  </span>
                  <span className="line-clamp-1 min-w-0 flex-1 text-[14px] font-medium">
                    {ep.title ?? `Episode ${ep.number}`}
                  </span>
                  {ep.filler && <span className="shrink-0 text-[11px] font-semibold text-amber-300">Filler</span>}
                  <Play size={15} fill="currentColor" className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              );
            }
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
                className={`relative grid h-12 place-items-center rounded-lg text-[15px] font-semibold tabular-nums transition-colors active:scale-95 ${
                  isResume
                    ? "bg-white text-black"
                    : "bg-ink-800 text-white/80 hover:bg-white hover:text-black"
                }`}
              >
                {ep.number}
                {ep.filler && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-300" />
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Latest from source (background episodes land here) */}
      {hasAniwatch && filteredAniwatch.length > 0 && (
        <details className="mt-2 border-t border-[var(--glass-border)] pt-4">
          <summary className="cursor-pointer text-[14px] font-semibold text-white/60 hover:text-white">
            Recent uploads ({filteredAniwatch.length})
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
                  className="flex h-12 items-center justify-between gap-2 rounded-lg bg-ink-800 px-3.5 transition-colors hover:bg-ink-700"
                >
                  <span className="line-clamp-1 min-w-0 flex-1 text-[13.5px] font-medium text-white/80">
                    {number != null ? `Episode ${number}` : cleanAniwatchTitle(ep.title)}
                  </span>
                  <span className="shrink-0 rounded-[5px] bg-white/10 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-white/70">
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
