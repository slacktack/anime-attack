"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { browseCharacters } from "@/lib/anime/anilist-extra";
import { useDebounce } from "@/lib/ui/useDebounce";
import { Card3D } from "@/components/ui/Card3D";

export function CharactersExplore() {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);
  const { data, isFetching } = useQuery({
    queryKey: ["characters", debounced],
    queryFn: () => browseCharacters(1, debounced.trim() || undefined),
    enabled: true,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Characters</h1>
      <p className="text-sm text-white/40">Every character in existence</p>

      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search characters…"
        className="mt-6 w-full rounded-2xl border border-white/10 bg-ink-800 px-4 py-3 text-base outline-none focus:border-accent-purple"
      />

      {isFetching && <p className="mt-4 text-sm text-white/40">Loading…</p>}

      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {data?.map((c) => (
          <Link key={c.id} href={`/character/${c.id}`} className="block">
            <Card3D className="group relative overflow-hidden rounded-2xl bg-ink-700 shadow-lg shadow-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.image ?? ""}
                alt={c.name}
                loading="lazy"
                className="aspect-[2/3] w-full rounded-2xl object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                <p className="line-clamp-2 text-xs font-semibold">{c.name}</p>
                <p className="flex items-center gap-1 text-[10px] text-accent-crimson">
                  <Heart size={11} color="currentColor" fill="currentColor" /> {c.favourites}
                </p>
              </div>
            </Card3D>
          </Link>
        ))}
      </div>
    </div>
  );
}
