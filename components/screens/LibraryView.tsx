"use client";
import { useEffect, useState } from "react";
import { getFavorites, getContinueWatching } from "@/lib/storage/store";
import { PosterCard } from "@/components/ui/PosterCard";
import { Carousel } from "@/components/ui/Carousel";
import type { AnimeSummary } from "@/lib/anime/types";

export function LibraryView() {
  const [favs, setFavs] = useState<AnimeSummary[]>([]);
  const [cw, setCw] = useState<{ anime: AnimeSummary; episode: number }[]>([]);
  useEffect(() => { setFavs(getFavorites()); setCw(getContinueWatching()); }, []);

  return (
    <div className="pt-8">
      <h1 className="mb-6 px-4 text-2xl font-black">Library</h1>
      <div className="mb-6 grid grid-cols-2 gap-3 px-4">
        <div className="rounded-2xl bg-ink-800 p-4"><p className="text-2xl font-black text-accent-purple">{favs.length}</p><p className="text-xs text-white/50">Favorites</p></div>
        <div className="rounded-2xl bg-ink-800 p-4"><p className="text-2xl font-black text-accent-blue">{cw.length}</p><p className="text-xs text-white/50">In progress</p></div>
      </div>
      {cw.length > 0 && <Carousel title="Continue Watching">{cw.map((p) => <PosterCard key={p.anime.id} anime={p.anime} />)}</Carousel>}
      <h2 className="mb-3 mt-4 px-4 text-lg font-bold">Favorites</h2>
      {favs.length === 0 ? <p className="px-4 text-sm text-white/40">No favorites yet — tap ❤️ on any anime.</p> : (
        <div className="grid grid-cols-3 gap-3 px-4 sm:grid-cols-4 md:grid-cols-6">{favs.map((a) => <PosterCard key={a.id} anime={a} />)}</div>
      )}
    </div>
  );
}
