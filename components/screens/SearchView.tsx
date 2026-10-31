"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Play, Search } from "lucide-react";
import { fetchSearch, fetchEpisodeSearch } from "@/lib/client/api";
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
  const anilistList = anilistResults.data ?? [];
  const aniwatchList = aniwatchResults.data ?? [];

  return (
    <div className="px-4 pt-3">
      <h1 className="flex items-center gap-2 font-display text-[26px] font-bold tracking-tight">
        <Search size={21} className="text-accent-purple" />
        Search
      </h1>

      <label className="relative mt-3 block">
        <Search
          size={17}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
        />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search anime…"
          autoFocus
          inputMode="search"
          className="nb-input pl-11 text-[15px]"
          style={{ minHeight: 54 }}
        />
      </label>

      <div className="mt-3 flex gap-1.5">
        {(["anilist", "aniwatch"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSource(key)}
            aria-pressed={source === key}
            className={`rounded-xl border px-3 py-1.5 text-[12px] font-bold transition-all ${
              source === key
                ? "border-transparent bg-gradient-to-br from-[color:var(--accent-purple)] to-[color:var(--accent-blue)] text-white"
                : "border-white/12 bg-white/[0.05] text-white/60"
            }`}
          >
            {key === "anilist" ? "Catalogue" : "Episodes"}
          </button>
        ))}
      </div>

      {!enabled && (
        <div className="mt-6">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/35">
            Try searching
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTerm(s)}
                className="rounded-xl border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[12px] font-semibold text-white/60 transition-colors hover:bg-white/[0.1]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {isFetching && (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[2/3] w-full" />
          ))}
        </div>
      )}

      {!isFetching && enabled && source === "anilist" && (
        anilistList.length > 0 ? (
          <>
            <p className="mt-4 text-[11.5px] font-semibold text-white/40">
              {anilistList.length} result{anilistList.length === 1 ? "" : "s"}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {anilistList.map((a) => (
                <PosterCard key={a.id} anime={a} />
              ))}
            </div>
          </>
        ) : (
          <div className="nb-card mt-4 p-6 text-center">
            <p className="font-display text-[14px] font-bold">No titles found</p>
            <p className="mt-1 text-[12px] text-white/45">Check the spelling or try another name.</p>
          </div>
        )
      )}

      {!isFetching && enabled && source === "aniwatch" && (
        aniwatchList.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2">
            {aniwatchList.map((ep) => (
              <Link
                key={ep.id}
                href={`/watch/${ep.slug}`}
                prefetch={false}
                className="flex min-h-[54px] items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 transition-colors hover:border-white/20 hover:bg-white/[0.08]"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-[13px] font-semibold text-white/85">{ep.title}</p>
                  <p className="text-[10.5px] font-semibold text-white/35">
                    {new Date(ep.date).toLocaleDateString()}
                  </p>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[color:var(--accent-purple)] to-[color:var(--accent-blue)] text-white">
                  <Play size={13} fill="currentColor" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="nb-card mt-4 p-6 text-center">
            <p className="font-display text-[14px] font-bold">No episodes found</p>
            <p className="mt-1 text-[12px] text-white/45">
              The source only lists recent episodes — try the catalogue tab.
            </p>
          </div>
        )
      )}
    </div>
  );
}
