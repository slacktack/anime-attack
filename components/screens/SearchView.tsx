"use client";
import { FranchiseCard, type Franchise } from "@/components/screens/FranchiseCard";

import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Play, Search } from "lucide-react";
import { fetchSearch, fetchEpisodeSearch, fetchSeasons } from "@/lib/client/api";
import { useDebounce } from "@/lib/ui/useDebounce";
import { PosterCard } from "@/components/ui/PosterCard";

const SUGGESTIONS = ["One Piece", "Jujutsu Kaisen", "Frieren", "Bleach", "Cyberpunk"];

export function SearchView() {
  const [term, setTerm] = useState("");
  const [source, setSource] = useState<"anilist" | "aniwatch">("anilist");
  const q = useDebounce(term, 250);
  const enabled = q.trim().length > 1;

  const anilistResults = useQuery({
    queryKey: ["search", q],
    queryFn: () => fetchSearch(q),
    enabled,
  });

  const aniwatchResults = useQuery({
    queryKey: ["aniwatch-search", q],
    queryFn: () => fetchEpisodeSearch(q),
    enabled,
  });

  const isFetching = source === "anilist" ? anilistResults.isFetching : aniwatchResults.isFetching;
  // PVs, CMs and music videos are noise in search
  const anilistList = (anilistResults.data ?? []).filter(
    (a) => a.type !== "MUSIC" && !/\b(PV|CM|trailer|teaser)\b/i.test(a.title),
  );
  // Group results by franchise: look up the season chain of the top few TV results.
  const seeds = anilistList.filter((a) => a.type === "TV" || a.type === "ONA").slice(0, 3);
  const families = useQueries({
    queries: seeds.map((seed) => ({
      queryKey: ["seasons", seed.id],
      queryFn: () => fetchSeasons(seed.id),
      staleTime: 30 * 60 * 1000,
    })),
  });
  const familyData = families.map((f) => f.data);
  const { franchises, rest } = useMemo(() => {
    const out: Franchise[] = [];
    const grouped = new Set<number>();
    for (const data of familyData) {
      if (!data || data.seasons.length + data.extras.length < 2) continue;
      const ids = [...data.seasons, ...data.extras].map((x) => x.id);
      const key = Math.min(...ids);
      if (out.some((f) => f.key === key)) continue;
      // only fold in members that actually matched the search
      if (!ids.some((id) => anilistList.some((a) => a.id === id))) continue;
      out.push({ key, seasons: data.seasons, extras: data.extras });
      ids.forEach((id) => grouped.add(id));
    }
    return { franchises: out, rest: anilistList.filter((a) => !grouped.has(a.id)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(familyData.map((d) => d?.seasons.map((x) => x.id))), anilistList]);
  const aniwatchList = aniwatchResults.data ?? [];

  return (
    <div className="aa-gutter pb-12 pt-4 lg:pt-8">
      <label className="relative block max-w-3xl">
        <Search
          size={22}
          className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-white/45"
        />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Titles, seasons, movies…"
          autoFocus
          inputMode="search"
          enterKeyHint="search"
          className="nb-input pl-14 font-display !text-[18px] font-semibold lg:!text-[22px]"
          style={{ minHeight: 64 }}
        />
      </label>

      <div className="mt-4 flex gap-2">
        {(["anilist", "aniwatch"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSource(key)}
            aria-pressed={source === key}
            className="aa-pill"
          >
            {key === "anilist" ? "Shows & movies" : "New episodes"}
          </button>
        ))}
      </div>

      {!enabled && (
        <div className="mt-10">
          <p className="text-[14px] font-semibold text-muted">Popular searches</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTerm(s)}
                className="aa-pill"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {isFetching && (
        <div className="mt-8 aa-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[2/3] w-full" />
          ))}
        </div>
      )}

      {!isFetching && enabled && source === "anilist" && (
        anilistList.length > 0 ? (
          <>
            {franchises.length > 0 && (
              <div className="mt-8 flex flex-col gap-3">
                {franchises.map((f) => (
                  <FranchiseCard key={f.key} franchise={f} />
                ))}
              </div>
            )}
            {rest.length > 0 && (
              <p className="mt-8 text-[13px] text-muted">
                {franchises.length ? "More results" : `${rest.length} result${rest.length === 1 ? "" : "s"}`}
              </p>
            )}
            <div className="mt-3 aa-grid">
              {rest.map((a) => (
                <PosterCard key={a.id} anime={a} fluid />
              ))}
            </div>
          </>
        ) : (
          <div className="py-16 text-center">
            <p className="font-display text-[20px] font-bold">No titles found</p>
            <p className="mt-1 text-[12px] text-white/45">Check the spelling or try another name.</p>
          </div>
        )
      )}

      {!isFetching && enabled && source === "aniwatch" && (
        aniwatchList.length > 0 ? (
          <div className="mt-8 grid gap-2 lg:grid-cols-2">
            {aniwatchList.map((ep) => (
              <Link
                key={ep.id}
                href={`/watch/${ep.slug}`}
                prefetch={false}
                className="flex min-h-[60px] items-center justify-between gap-3 rounded-lg bg-ink-800 px-4 py-2.5 transition-colors hover:bg-ink-700"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-[14px] font-semibold text-white/90">{ep.title}</p>
                  <p className="text-[12px] text-muted">
                    {new Date(ep.date).toLocaleDateString()}
                  </p>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-black">
                  <Play size={13} fill="currentColor" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <p className="font-display text-[20px] font-bold">No episodes found</p>
            <p className="mt-1 text-[12px] text-white/45">
              The source only lists recent episodes — try the catalogue tab.
            </p>
          </div>
        )
      )}
    </div>
  );
}
