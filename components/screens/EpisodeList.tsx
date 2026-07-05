"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEpisodesByMal } from "@/lib/anime/jikan";
import { fetchEpisodesByCategory } from "@/lib/anime/aniwatch";
import { useDebounce } from "@/lib/ui/useDebounce";

const RANGE_SIZE = 100;

type EpisodeListProps = {
  malId: number | null;
  aniwatchCategoryId?: number;
  aniwatchCategoryName?: string;
};

export function EpisodeList({ malId, aniwatchCategoryId, aniwatchCategoryName }: EpisodeListProps) {
  const [rangeStart, setRangeStart] = useState(0);
  const [term, setTerm] = useState("");
  const debouncedTerm = useDebounce(term, 200);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["episodes", malId],
    queryFn: () => getEpisodesByMal(malId as number),
    enabled: malId != null,
  });

  const aniwatch = useQuery({
    queryKey: ["aniwatch-episodes", aniwatchCategoryId],
    queryFn: () => fetchEpisodesByCategory(aniwatchCategoryId as number),
    enabled: aniwatchCategoryId != null,
  });

  const episodes = useMemo(() => data ?? [], [data]);
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

  const filteredEpisodes = useMemo(() => {
    const query = debouncedTerm.trim().toLowerCase();
    if (!query) return rangedEpisodes;
    return rangedEpisodes.filter((ep) => {
      if (String(ep.number).includes(query)) return true;
      return (ep.title ?? "").toLowerCase().includes(query);
    });
  }, [rangedEpisodes, debouncedTerm]);

  const hasJikan = malId != null;
  const hasAniwatch = aniwatchCategoryId != null;

  if (!hasJikan && !hasAniwatch) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-sm font-bold text-white/60">No episodes available for this anime</p>
        <p className="mt-2 text-xs text-white/40">
          Try searching on the Search page or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4">
      {hasJikan && (
        <>
          {ranges.length > 0 && (
            <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
              {ranges.map((range, i) => (
                <button
                  key={range.start}
                  type="button"
                  onClick={() => setRangeStart(i)}
                  className={`nb-btn shrink-0 px-4 py-2 text-xs ${
                    i === rangeStart ? "nb-btn-accent" : ""
                  }`}
                  style={{ minHeight: 40 }}
                >
                  {range.start + 1}-{range.end}
                </button>
              ))}
            </div>
          )}

          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Find episode number or title…"
            inputMode="search"
            className="nb-input mb-4"
          />

          {isLoading || isFetching ? (
            <p className="py-6 text-center text-sm text-white/60">Loading episodes…</p>
          ) : filteredEpisodes.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/60">No episodes found</p>
          ) : (
            <div className="flex flex-col gap-2.5 pb-4">
              {filteredEpisodes.map((ep) => (
                <div
                  key={ep.number}
                  className="nb-border nb-shadow-sm flex min-h-[48px] items-center justify-between gap-3 rounded-xl bg-ink-800 p-3.5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="shrink-0 text-sm font-bold text-accent-progress">
                      EP {ep.number}
                    </span>
                    <span className="line-clamp-1 min-w-0 flex-1 text-sm font-medium text-white/80">
                      {ep.title ?? "Untitled"}
                    </span>
                  </div>
                  <span
                    className={`nb-tag shrink-0 ${
                      ep.filler
                        ? "bg-accent-gold/20 text-accent-gold"
                        : "bg-accent-stats/20 text-accent-stats"
                    }`}
                  >
                    {ep.filler ? "Filler" : "Canon"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {hasJikan && hasAniwatch && (
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/15" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
            {aniwatchCategoryName ? `From AniwatchTV: ${aniwatchCategoryName}` : "From AniwatchTV"}
          </span>
          <div className="h-px flex-1 bg-white/15" />
        </div>
      )}

      {hasAniwatch && (
        <div className="flex flex-col gap-2.5 pb-4">
          {aniwatch.isLoading || aniwatch.isFetching ? (
            <p className="py-6 text-center text-sm text-white/60">Loading AniwatchTV episodes…</p>
          ) : aniwatchEpisodes.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">No AniwatchTV episodes found</p>
          ) : (
            aniwatchEpisodes.map((ep) => (
              <Link
                key={ep.id}
                href={`/watch/${ep.slug}`}
                className="nb-border nb-shadow-sm flex min-h-[48px] items-center justify-between gap-3 rounded-xl bg-ink-800 p-3.5 hover:bg-ink-700 transition-colors"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="shrink-0 text-sm font-bold text-accent-progress">
                    {ep.title}
                  </span>
                </div>
                <span
                  className="nb-btn nb-btn-accent shrink-0 px-3 py-1.5 text-xs"
                  data-card-accent="progress"
                >
                  WATCH
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
