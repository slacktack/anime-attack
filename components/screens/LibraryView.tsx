"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, Library, Play } from "lucide-react";
import { getFavorites, getContinueWatching } from "@/lib/storage/store";
import { PosterCard } from "@/components/ui/PosterCard";
import type { AnimeSummary } from "@/lib/anime/types";

export function LibraryView() {
  const [favs, setFavs] = useState<AnimeSummary[]>([]);
  const [cw, setCw] = useState<{ anime: AnimeSummary; episode: number }[]>([]);

  useEffect(() => {
    setFavs(getFavorites());
    setCw(getContinueWatching());
  }, []);

  return (
    <div className="flex flex-col gap-4 px-4 pt-3">
      <header>
        <h1 className="flex items-center gap-2 font-display text-[26px] font-bold tracking-tight">
          <Library size={21} className="text-accent-purple" />
          Library
        </h1>
        <p className="mt-0.5 text-[12.5px] font-semibold text-white/40">
          Everything you saved and everything you started.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="nb-card p-3.5" data-card-accent="library">
          <p className="font-display text-[26px] font-bold leading-none text-accent-purple">
            {favs.length}
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white/40">
            Favorites
          </p>
        </div>
        <div className="nb-card p-3.5" data-card-accent="progress">
          <p className="font-display text-[26px] font-bold leading-none text-accent-blue">
            {cw.length}
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white/40">
            In progress
          </p>
        </div>
      </div>

      {cw.length > 0 && (
        <section>
          <h2 className="mb-2.5 flex items-center gap-2 font-display text-[16px] font-bold">
            <Play size={14} className="text-accent-purple" />
            Continue watching
          </h2>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {cw.map((p) => (
              <div key={p.anime.id} className="relative shrink-0">
                <PosterCard anime={p.anime} />
                {p.episode > 0 && (
                  <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[9.5px] font-black text-white backdrop-blur">
                    EP {p.episode}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2.5 flex items-center gap-2 font-display text-[16px] font-bold">
          <Heart size={14} className="text-rose-400" />
          Favorites
        </h2>
        {favs.length === 0 ? (
          <div className="nb-card p-6 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-white/12 bg-white/[0.06]">
              <Heart size={19} className="text-rose-400" />
            </span>
            <p className="mt-2.5 font-display text-[14px] font-bold">Nothing saved yet</p>
            <p className="mx-auto mt-1 max-w-[280px] text-[12px] leading-snug text-white/45">
              Tap the heart on any anime page and it will show up here.
            </p>
            <Link href="/browse" className="nb-btn nb-btn-accent mx-auto mt-3">
              Find something to watch
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {favs.map((a) => (
              <PosterCard key={a.id} anime={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
