"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { searchAnime } from "@/lib/anime/anilist";
import { searchPosts } from "@/lib/anime/aniwatch";
import { useDebounce } from "@/lib/ui/useDebounce";
import { PosterCard } from "@/components/ui/PosterCard";

export function SearchView() {
  const [term, setTerm] = useState("");
  const [source, setSource] = useState<"anilist" | "aniwatch">("anilist");
  const q = useDebounce(term, 250);

  const { data: anilistResults, isFetching: anilistLoading } = useQuery({
    queryKey: ["search", q], queryFn: () => searchAnime(q), enabled: q.trim().length > 1,
  });

  const { data: aniwatchResults, isFetching: aniwatchLoading } = useQuery({
    queryKey: ["aniwatch-search", q], queryFn: () => searchPosts(q), enabled: q.trim().length > 1,
  });

  const isFetching = source === "anilist" ? anilistLoading : aniwatchLoading;

  return (
    <div className="px-4 pt-8" data-card-accent="search">
      <h2 className="nb-section-header">Search</h2>
      <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search anime…" autoFocus
        className="nb-input min-h-14 text-lg" />

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setSource("anilist")}
          className={`nb-btn text-xs ${source === "anilist" ? "nb-btn-accent" : ""}`}
          style={{ minHeight: 36 }}
        >
          AniList
        </button>
        <button
          onClick={() => setSource("aniwatch")}
          className={`nb-btn text-xs ${source === "aniwatch" ? "nb-btn-accent" : ""}`}
          data-card-accent="progress"
          style={{ minHeight: 36 }}
        >
          AniwatchTV
        </button>
      </div>

      {isFetching && <p className="mt-4 text-sm font-bold text-white/60">Searching…</p>}

      {source === "anilist" && anilistResults && anilistResults.length > 0 && (
        <>
          <span className="nb-tag mt-4">{anilistResults.length} result{anilistResults.length !== 1 ? "s" : ""}</span>
          <div className="nb-card mt-4 p-4">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {anilistResults.map((a) => <PosterCard key={a.id} anime={a} />)}
            </div>
          </div>
        </>
      )}

      {source === "aniwatch" && aniwatchResults && (
        <>
          <span className="nb-tag mt-4">{aniwatchResults.length} episode{aniwatchResults.length !== 1 ? "s" : ""}</span>
          <div className="nb-card mt-4 p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {aniwatchResults.map((ep) => (
                <Link key={ep.id} href={`/watch/${ep.slug}`} className="nb-card-sm bg-ink-700 p-3 block">
                  <p className="font-display text-xs font-bold leading-tight line-clamp-2">{ep.title}</p>
                  <p className="mt-1 text-[10px] text-white/50">{new Date(ep.date).toLocaleDateString()}</p>
                  <span className="nb-tag mt-1.5" data-card-accent="progress">WATCH</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
