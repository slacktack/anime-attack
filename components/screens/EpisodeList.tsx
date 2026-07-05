"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEpisodesByMal } from "@/lib/anime/jikan";
import { useDebounce } from "@/lib/ui/useDebounce";

const RANGE_SIZE = 100;

type EpisodeListProps = {
  malId: number | null;
};

export function EpisodeList({ malId }: EpisodeListProps) {
  const [rangeStart, setRangeStart] = useState(0);
  const [term, setTerm] = useState("");
  const debouncedTerm = useDebounce(term, 200);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["episodes", malId],
    queryFn: () => getEpisodesByMal(malId as number),
    enabled: malId != null,
  });

  const episodes = data ?? [];

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

  if (malId == null) {
    return <p className="px-4 py-3 text-sm text-white/40">Episode list unavailable</p>;
  }

  return (
    <div className="px-4">
      {ranges.length > 0 && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {ranges.map((range, i) => (
            <button
              key={range.start}
              type="button"
              onClick={() => setRangeStart(i)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                i === rangeStart
                  ? "bg-accent-purple text-white"
                  : "bg-ink-800 text-white/60"
              }`}
              style={{ minHeight: 44 }}
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
        className="mb-4 w-full rounded-2xl border border-white/10 bg-ink-800 px-4 py-3 text-base outline-none focus:border-accent-purple"
        style={{ minHeight: 44 }}
      />

      {isLoading || isFetching ? (
        <p className="py-6 text-center text-sm text-white/40">Loading episodes…</p>
      ) : filteredEpisodes.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/40">No episodes found</p>
      ) : (
        <div className="flex flex-col gap-2 pb-4">
          {filteredEpisodes.map((ep) => (
            <div
              key={ep.number}
              className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl bg-ink-800 p-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="shrink-0 text-sm font-semibold text-white/80">
                  EP {ep.number}
                </span>
                <span className="line-clamp-1 min-w-0 flex-1 text-sm text-white/60">
                  {ep.title ?? "Untitled"}
                </span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  ep.filler
                    ? "bg-accent-gold/20 text-accent-gold"
                    : "bg-white/10 text-white/60"
                }`}
              >
                {ep.filler ? "Filler" : "Canon"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
