"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { browseCharacters } from "@/lib/anime/anilist-extra";
import { useDebounce } from "@/lib/ui/useDebounce";

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
      <h1 className="nb-heading nb-heading-xl">Characters</h1>
      <div className="nb-section-header mt-1">Every Character in Existence</div>

      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search characters…"
        className="nb-input mt-4"
        style={{ "--card-accent": "var(--nb-accent-characters)" } as React.CSSProperties}
      />

      {isFetching && <p className="mt-4 font-bold text-white/60">Loading…</p>}

      <div className="nb-card mt-6 bg-ink-800 p-4">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {data?.map((c) => (
            <Link key={c.id} href={`/character/${c.id}`} className="block">
              <div className="nb-card-sm group relative overflow-hidden bg-ink-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.image ?? ""}
                  alt={c.name}
                  loading="lazy"
                  className="aspect-[2/3] w-full rounded-[10px] object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                  <p className="line-clamp-2 text-xs font-bold">{c.name}</p>
                  <p className="flex items-center gap-1 text-[10px] font-bold text-accent-crimson">
                    <Heart size={11} color="currentColor" fill="currentColor" /> {c.favourites}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
