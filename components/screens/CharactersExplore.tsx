"use client";
import { PageHeader } from "@/components/ui/PageHeader";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Drama, Heart, Search } from "lucide-react";
import { fetchCharacters } from "@/lib/client/api";
import { useDebounce } from "@/lib/ui/useDebounce";

export function CharactersExplore() {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);
  const { data, isFetching } = useQuery({
    queryKey: ["characters", debounced],
    queryFn: () => fetchCharacters(1, debounced.trim() || undefined),
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Characters" subtitle="The most favourited characters across all anime." />

      <label className="relative block">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
        />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search characters…"
          inputMode="search"
          className="nb-input pl-11 sm:max-w-md"
          style={{ minHeight: 50 }}
        />
      </label>

      {isFetching && !data ? (
        <div className="aa-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[2/3] w-full" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="aa-grid">
          {data.map((c) => (
            <Link key={c.id} href={`/character/${c.id}`} className="group block">
              <div className="poster-frame aspect-[2/3] ring-1 ring-inset ring-white/[0.06]">
                {c.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-white/90 group-hover:text-white">
                {c.name}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
                <Heart size={11} fill="currentColor" className="text-accent-purple" /> {c.favourites.toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="font-display text-[20px] font-bold">No characters found</p>
          <p className="mt-1 text-[14px] text-muted">Try a different spelling.</p>
        </div>
      )}
    </div>
  );
}
