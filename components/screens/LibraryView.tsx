"use client";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { getFavorites, getContinueWatching } from "@/lib/storage/store";
import { PosterCard } from "@/components/ui/PosterCard";
import { Carousel } from "@/components/ui/Carousel";
import type { AnimeSummary } from "@/lib/anime/types";

export function LibraryView() {
  const [favs, setFavs] = useState<AnimeSummary[]>([]);
  const [cw, setCw] = useState<{ anime: AnimeSummary; episode: number }[]>([]);
  useEffect(() => { setFavs(getFavorites()); setCw(getContinueWatching()); }, []);

  return (
    <div>
      <h1 className="nb-heading nb-heading-xl">Library</h1>
      <div className="nb-section-header mt-1">Your Collection</div>

      <div className="mt-4 mb-6 grid grid-cols-2 gap-3">
        <div className="nb-card bg-ink-800 p-4">
          <p className="nb-heading nb-heading-lg text-accent-purple">{favs.length}</p>
          <p className="text-xs font-bold text-white/60">Favorites</p>
        </div>
        <div className="nb-card bg-ink-800 p-4">
          <p className="nb-heading nb-heading-lg text-accent-blue">{cw.length}</p>
          <p className="text-xs font-bold text-white/60">In Progress</p>
        </div>
      </div>

      {cw.length > 0 && (
        <div className="nb-card mb-6 bg-ink-800 p-4">
          <Carousel title="Continue Watching">{cw.map((p) => <PosterCard key={p.anime.id} anime={p.anime} />)}</Carousel>
        </div>
      )}

      <div className="nb-card bg-ink-800 p-4">
        <div className="nb-section-header">Favorites</div>
        {favs.length === 0 ? (
          <p className="flex items-center gap-1 font-bold text-white/60">
            No favorites yet — tap <Heart size={14} color="currentColor" fill="currentColor" className="text-accent-crimson" /> on any anime to add it here.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">{favs.map((a) => <PosterCard key={a.id} anime={a} />)}</div>
        )}
      </div>
    </div>
  );
}
