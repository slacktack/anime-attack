"use client";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { isFavorite, toggleFavorite } from "@/lib/storage/store";
import type { AnimeSummary } from "@/lib/anime/types";

export function FavoriteButton({
  anime,
  iconOnly = false,
}: {
  anime: AnimeSummary;
  iconOnly?: boolean;
}) {
  const [fav, setFav] = useState(false);
  useEffect(() => setFav(isFavorite(anime.id)), [anime.id]);

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={() => setFav(toggleFavorite(anime))}
        aria-pressed={fav}
        aria-label={fav ? "Remove from favorites" : "Add to favorites"}
        className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl border transition-all active:scale-95 ${
          fav
            ? "border-rose-400/40 bg-rose-500/[0.18] text-rose-300 shadow-[0_16px_34px_-18px_rgba(244,63,94,0.8)]"
            : "border-white/15 bg-white/[0.06] text-white/70 hover:bg-white/[0.1]"
        }`}
      >
        <Heart size={21} fill={fav ? "currentColor" : "none"} strokeWidth={2.1} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setFav(toggleFavorite(anime))}
      aria-pressed={fav}
      className={fav ? "nb-btn nb-btn-accent" : "nb-btn"}
    >
      <Heart size={16} fill={fav ? "currentColor" : "none"} />
      {fav ? "In your list" : "Add to list"}
    </button>
  );
}
