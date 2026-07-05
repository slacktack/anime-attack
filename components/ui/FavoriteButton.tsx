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
      className={fav ? "nb-btn nb-btn-accent" : "nb-btn"}>
      <Heart size={16} color="currentColor" fill={fav ? "currentColor" : "none"} />
      {fav ? "Favorited" : "Favorite"}
    </button>
  );
}
