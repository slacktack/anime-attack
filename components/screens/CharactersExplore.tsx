"use client";

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
      <header>
        <h1 className="flex items-center gap-2 font-display text-[26px] font-bold tracking-tight">
          <Drama size={21} className="text-accent-crimson" />
          Characters
        </h1>
        <p className="mt-0.5 text-[12.5px] font-semibold text-white/40">
          The most favourited characters across all anime.
        </p>
      </header>

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
          className="nb-input pl-11"
          style={{ minHeight: 50 }}
        />
      </label>

      {isFetching && !data ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[2/3] w-full" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {data.map((c) => (
            <Link
              key={c.id}
              href={`/character/${c.id}`}
              className="group relative overflow-hidden rounded-2xl border border-nb-border bg-ink-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.image ?? ""}
                alt={c.name}
                loading="lazy"
                className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                <p className="line-clamp-2 text-[11px] font-bold leading-tight text-white">
                  {c.name}
                </p>
                <p className="flex items-center gap-1 text-[10px] font-bold text-rose-300">
                  <Heart size={10} fill="currentColor" /> {c.favourites.toLocaleString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="nb-card p-6 text-center">
          <p className="font-display text-[14px] font-bold">No characters found</p>
          <p className="mt-1 text-[12px] text-white/45">Try a different name.</p>
        </div>
      )}
    </div>
  );
}
