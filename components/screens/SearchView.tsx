"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { searchAnime } from "@/lib/anime/anilist";
import { useDebounce } from "@/lib/ui/useDebounce";
import { PosterCard } from "@/components/ui/PosterCard";

export function SearchView() {
  const [term, setTerm] = useState("");
  const q = useDebounce(term, 250);
  const { data, isFetching } = useQuery({
    queryKey: ["search", q], queryFn: () => searchAnime(q), enabled: q.trim().length > 1,
  });
  return (
    <div className="px-4 pt-8">
      <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search anime…" autoFocus
        className="w-full rounded-2xl border border-white/10 bg-ink-800 px-4 py-3 text-base outline-none focus:border-accent-purple" />
      {isFetching && <p className="mt-4 text-sm text-white/40">Searching…</p>}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {data?.map((a) => <PosterCard key={a.id} anime={a} />)}
      </div>
    </div>
  );
}
