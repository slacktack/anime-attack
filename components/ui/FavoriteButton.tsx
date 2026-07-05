"use client";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { isFavorite, toggleFavorite } from "@/lib/storage/store";
import type { AnimeSummary } from "@/lib/anime/types";

export function FavoriteButton({ anime }: { anime: AnimeSummary }) {
  const [fav, setFav] = useState(false);
  useEffect(() => setFav(isFavorite(anime.id)), [anime.id]);
  return (
    <button onClick={() => setFav(toggleFavorite(anime))}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${fav ? "bg-accent-crimson text-white" : "bg-white/10 text-white"}`}>
      <Heart size={16} color="currentColor" fill={fav ? "currentColor" : "none"} />
      {fav ? "Favorited" : "Favorite"}
    </button>
  );
}
